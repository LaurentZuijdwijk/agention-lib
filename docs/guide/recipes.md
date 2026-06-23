# Recipes

End-to-end patterns that combine Agention's building blocks into something you'd
ship. Each recipe lives as a self-contained, runnable project under
[`examples/recipes/`](https://github.com/laurentzuijdwijk/agention-lib/tree/master/examples/recipes).

Where the [Examples](/guide/examples) page shows one feature at a time, recipes
wire several together: persistence, streaming, tools, and conversational memory.

---

## Chatbot on Hono with Redis history

A chat **API** served with [Hono](https://hono.dev) that keeps each user's
conversation in Redis. The agent is **stateless** — history is loaded per request
and written back afterwards — so you can run many instances behind a load
balancer and any of them can serve any session.

**Demonstrates:** HTTP serving · per-session persistence with `RedisHistory` · SSE streaming · token-budget trimming

The core idea is that an agent accepts a `History` instance, and the library
ships a `RedisHistory` subclass with `load(key)` / `save(key)`. So a request
handler is just: load → run → save.

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { RedisHistory } from '@agentionai/agents/history';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const key = (id: string) => `chat:history:${id}`;

app.post('/chat/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const { message } = await c.req.json();

  // 1. Load this session's transcript from Redis (trim to fit the window).
  const history = new RedisHistory(redis, { maxTokens: 8000 });
  await history.load(key(sessionId));

  // 2. Build a stateless agent bound to that history.
  const agent = new ClaudeAgent(
    {
      id: 'chatbot',
      name: 'Assistant',
      description: 'You are a friendly, concise assistant.',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-haiku-4-5',
      tools: [weatherTool],
    },
    history,
  );

  // 3. Run the turn, then persist the updated transcript with a sliding TTL.
  const reply = await agent.execute(message);
  await history.save(key(sessionId));
  await redis.expire(key(sessionId), 60 * 60 * 24 * 7);

  return c.json({ reply });
});
```

Streaming is the same pattern with `executeStream()` piped over Server-Sent
Events; save the history once the stream finishes.

Because the history format is provider-agnostic, you can even resume a Claude
conversation with `OpenAiAgent` or `MistralAgent`. For very long chats, swap the
`maxTokens` FIFO trim for a [compression plugin](/guide/history) that summarizes
old turns instead of dropping them.

The recipe ships with a `Dockerfile` and `docker-compose.yml`, so
`docker compose up --build` brings up the chatbot and a persistent Redis together
(API key read from a local `.env`). It also serves a minimal web chat UI at
`http://localhost:3000` — a single self-contained `public/index.html` (no build
step) that streams responses over SSE.

➡️ **Full source:** [`examples/recipes/hono-redis-chatbot/`](https://github.com/laurentzuijdwijk/agention-lib/tree/master/examples/recipes/hono-redis-chatbot)

---

## Terminal research agent

An interactive CLI assistant that uses Claude's **server-side web search** to
gather live information, **streams its reasoning and answer**, and remembers the
thread for follow-ups.

**Demonstrates:** built-in (server-side) tools · streaming with visible reasoning · conversational memory

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { History } from '@agentionai/agents/history';
import { webSearchTool } from '@agentionai/agents/core';

const history = new History([], { maxTokens: 30000 });

const agent = new ClaudeAgent(
  {
    id: 'researcher',
    name: 'Research Agent',
    description:
      'You are a meticulous research assistant. Use web search for current ' +
      'facts and cite your sources.',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    thinkingBudgetTokens: 2048,            // extended thinking → reasoning stream
    builtInTools: [webSearchTool({ maxUses: 5 })],  // Anthropic runs the search
  },
  history,
);

// Stream reasoning (dimmed) and the answer to the terminal.
for await (const chunk of agent.executeStream('What changed in the latest TS release?')) {
  if (chunk.type === 'reasoning') process.stdout.write(`\x1b[2m${chunk.content}\x1b[0m`);
  else process.stdout.write(chunk.content);
}
```

`webSearchTool()` is a **built-in tool**: you don't write an `execute()` — pass
it via `builtInTools` and Anthropic performs the search server-side, feeding
results back to the model. Constrain it with `allowedDomains` / `blockedDomains`,
or localize results with `userLocation`.

➡️ **Full source:** [`examples/recipes/research-agent/`](https://github.com/laurentzuijdwijk/agention-lib/tree/master/examples/recipes/research-agent)

---

## Ensemble solver (mixture-of-agents)

Several models each independently solve the **same** problem, then a judge
synthesizes a single best answer from their candidates. Diversity is the point:
different models make *different* mistakes, so a judge that merges their
strengths tends to beat any single model — and beats sampling one model N times,
since those samples are correlated.

**Demonstrates:** `AgentGraph.parallel` · `votingSystem` (judge) · pipeline composition · multi-provider ensembling

The whole flow is one composed graph:

```typescript
import { AgentGraph, VotingInput } from '@agentionai/agents/core';

// solvers = [claude, gpt, mistral, ...]   judge = a synthesizing agent

const ensemble = AgentGraph.pipeline<string, string>(
  // 1. Every model answers the same prompt, concurrently → string[]
  AgentGraph.parallel({}, ...solvers),

  // 2. Reshape the candidate array into the judge's input
  {
    name: 'to-voting-input',
    nodeType: 'custom',
    execute: async (solutions: string[]): Promise<VotingInput> => ({
      originalInput: problem,
      solutions,
    }),
  },

  // 3. Judge synthesizes the best answer (not just picks one) → string
  AgentGraph.votingSystem(judge),
);

const answer = await ensemble.execute(problem);
```

This is the **inverse of a review team**: instead of one author and many
critics, you have many authors and one synthesizer.

The candidates don't have to come from different *models*. Diversity can come
from any of three knobs, which you can mix:

- **Model** — Claude vs. GPT vs. Mistral (the strongest source of diversity).
- **Prompt** — the same model with different system prompts (e.g. "favor
  creative approaches" vs. "favor the simplest thing that works").
- **Temperature** — the same model + prompt sampled at different temperatures
  (higher = more divergent). The recipe's single-key fallback uses temperature
  `1.0` for a "lateral" persona and `0.2` for a "pragmatic" one.

| Pattern | Authors | Critic | Good for |
| ------- | ------- | ------ | -------- |
| **Ensemble solver** | many models | 1 judge synthesizes | hard problems where you want the best possible answer |
| **Review team** | 1 author | many specialist reviewers | catching defects in a single proposed solution |

Give the judge an explicit rubric via `votingSystem(judge, { promptTemplate })`,
or use self-consistency (one solver sampled several times) when you want the
ensemble cheaper and less diverse.

**Enable thinking where it pays off.** Since this targets hard problems,
extended thinking helps — especially for the judge, whose whole job (comparing
and merging candidates) is reasoning-heavy. The recipe sets `thinkingBudgetTokens`
on the Claude judge and solver, and `reasoningEffort: 'medium'` on the OpenAI
solver. One gotcha: on Claude, thinking forces default sampling, so it's
**mutually exclusive with `temperature`** — pick one per agent. That's why the
temperature-diversity fallback keeps thinking off while the judge still thinks.

➡️ **Full source:** [`examples/recipes/ensemble-solver/`](https://github.com/laurentzuijdwijk/agention-lib/tree/master/examples/recipes/ensemble-solver)

---

## More ideas

These map cleanly onto existing features and make great next recipes:

- **Slack / Discord bot** — the Hono recipe driven by an events webhook; key
  history by channel or thread.
- **RAG documentation Q&A** — ingest Markdown with the chunkers + a
  [`VectorStore`](/guide/vector-stores), then answer with citations.
- **Scheduled report generator** — a cron job running an
  [`AgentGraph`](/guide/graph-pipelines) pipeline that emails a daily digest.
- **MCP-powered assistant** — connect an [MCP](/guide/mcp) server and expose its
  tools to the agent.
- **Code-review team** — a parallel graph of specialist reviewers (security,
  style, tests) whose findings are merged by a judge — the inverse of the
  ensemble solver above (many critics on one solution, not many authors).
