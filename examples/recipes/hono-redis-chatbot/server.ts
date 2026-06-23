/**
 * Recipe: Chatbot on a Hono server with Redis-backed history
 * ----------------------------------------------------------
 *
 * A stateless HTTP server that keeps per-session conversation history in Redis.
 * Each request:
 *   1. loads the session's history from Redis (via the built-in `RedisHistory`),
 *   2. hands that history to a fresh, stateless agent,
 *   3. runs the agent (tools included),
 *   4. persists the updated history back to Redis.
 *
 * Because history lives in Redis (not in process memory), you can run many
 * instances of this server behind a load balancer and any of them can serve
 * any session — the agent itself stays stateless.
 *
 * Endpoints:
 *   GET    /                       -> minimal web chat UI (public/index.html)
 *   POST   /chat/:sessionId        { "message": "..." }  -> { "reply": "..." }
 *   POST   /chat/:sessionId/stream { "message": "..." }  -> text/event-stream
 *   GET    /chat/:sessionId        -> the stored transcript
 *   DELETE /chat/:sessionId        -> wipe the session
 *
 * Run:
 *   npm install
 *   docker run -p 6379:6379 redis        # or any Redis you have
 *   ANTHROPIC_API_KEY=sk-... npm start
 *
 *   curl -s localhost:3000/chat/alice \
 *     -H 'content-type: application/json' \
 *     -d '{"message":"What is the weather in Lisbon?"}' | jq
 */

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { streamSSE } from "hono/streaming";
import Redis from "ioredis";

import { ClaudeAgent } from "@agentionai/agents/claude";
import { RedisHistory } from "@agentionai/agents/history";
import { Tool } from "@agentionai/agents/core";

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const HISTORY_PREFIX = "chat:history:";
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 7; // forget idle sessions after a week

const key = (sessionId: string) => `${HISTORY_PREFIX}${sessionId}`;

/**
 * Load a session's transcript from Redis into a RedisHistory instance.
 * `maxTokens` trims the oldest turns on load/save so a long-running chat never
 * overflows the context window (the system message is always preserved).
 */
async function loadHistory(sessionId: string): Promise<RedisHistory> {
  const history = new RedisHistory(redis, { maxTokens: 8000 });
  await history.load(key(sessionId));
  return history;
}

/** Persist a session's transcript back to Redis with a sliding TTL. */
async function saveHistory(
  sessionId: string,
  history: RedisHistory
): Promise<void> {
  await history.save(key(sessionId));
  await redis.expire(key(sessionId), HISTORY_TTL_SECONDS);
}

// ---------------------------------------------------------------------------
// Tools (a tiny weather example so the bot can actually do something)
// ---------------------------------------------------------------------------

const weatherTool = new Tool({
  name: "get_weather",
  description:
    "Get the current weather for a city. Returns temperature in celsius.",
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name, e.g. 'Lisbon'" },
    },
    required: ["city"],
  },
  execute: async ({ city }: { city: string }) => {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1`
    ).then((r) => r.json());
    const place = geo.results?.[0];
    if (!place) return { error: `Unknown city: ${city}` };

    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,wind_speed_10m`
    ).then((r) => r.json());

    return {
      city: place.name,
      country: place.country,
      temperature: wx.current?.temperature_2m,
      windSpeed: wx.current?.wind_speed_10m,
    };
  },
});

const SYSTEM_PROMPT = `You are a friendly, concise chat assistant.
You can look up live weather with the get_weather tool.
Remember earlier turns in the conversation and refer back to them when useful.`;

/** Build a stateless agent bound to the supplied (per-request) history. */
function createAgent(history: RedisHistory): ClaudeAgent {
  return new ClaudeAgent(
    {
      id: "chatbot",
      name: "Assistant",
      description: SYSTEM_PROMPT,
      apiKey: process.env.ANTHROPIC_API_KEY as string,
      model: "claude-haiku-4-5",
      maxTokens: 1024,
      tools: [weatherTool],
    },
    history
  );
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

// Minimal chat UI — a single self-contained HTML file (inline CSS + vanilla JS)
// that talks to the streaming endpoint below. Read once, then cached.
let indexHtml: string | null = null;
app.get("/", async (c) => {
  if (!indexHtml) {
    indexHtml = await readFile(
      new URL("./public/index.html", import.meta.url),
      "utf-8"
    );
  }
  return c.html(indexHtml);
});

// Standard request/response chat turn.
app.post("/chat/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const { message } = await c.req.json<{ message?: string }>();
  if (!message) return c.json({ error: "message is required" }, 400);

  const history = await loadHistory(sessionId);
  const agent = createAgent(history);

  const reply = await agent.execute(message);
  await saveHistory(sessionId, history);

  return c.json({ sessionId, reply });
});

// Streaming chat turn over Server-Sent Events.
app.post("/chat/:sessionId/stream", async (c) => {
  const sessionId = c.req.param("sessionId");
  const { message } = await c.req.json<{ message?: string }>();
  if (!message) return c.json({ error: "message is required" }, 400);

  const history = await loadHistory(sessionId);
  const agent = createAgent(history);

  return streamSSE(c, async (stream) => {
    for await (const chunk of agent.executeStream(message)) {
      // chunk.type is "text" | "reasoning"
      await stream.writeSSE({ event: chunk.type, data: chunk.content });
    }
    // executeStream() mutates `history` in place; persist the final transcript.
    await saveHistory(sessionId, history);
    await stream.writeSSE({ event: "done", data: "" });
  });
});

// Inspect a stored transcript.
app.get("/chat/:sessionId", async (c) => {
  const history = await loadHistory(c.req.param("sessionId"));
  return c.json({ entries: history.entries });
});

// Forget a session.
app.delete("/chat/:sessionId", async (c) => {
  await redis.del(key(c.req.param("sessionId")));
  return c.json({ ok: true });
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Chatbot listening on http://localhost:${port}`);
