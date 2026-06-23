# Recipe: Hono chatbot with Redis-backed history

A production-shaped chatbot served over HTTP with [Hono](https://hono.dev), keeping
each user's conversation in Redis. The agent itself is **stateless** — history is
loaded per request and written back afterwards — so you can scale the server
horizontally and any instance can serve any session.

## How it works

```
client ──POST /chat/:sessionId──▶ Hono
                                   │ 1. GET   chat:history:<id>  ← Redis
                                   │ 2. new History(...)  → new ClaudeAgent(history)
                                   │ 3. agent.execute(message)   (runs tools)
                                   │ 4. SET   chat:history:<id>  → Redis  (TTL 7d)
                                   ◀ { reply }
```

The key insight: `ClaudeAgent` accepts a `History` instance as its second
constructor argument, and the library ships a `RedisHistory` subclass with
`load(key)` / `save(key)` methods. On each request we `load` the session, run the
agent, then `save` and refresh the TTL. The `maxTokens` option keeps long
conversations from overflowing the context window (oldest turns are dropped while
the system message and tool pairs are preserved).

## Run it

Either way, start from a local `.env`:

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY
```

### Option A — Docker Compose (app + Redis together)

Brings up the chatbot and a persistent Redis with one command. The compose file
reads your `.env` for `ANTHROPIC_API_KEY` and points the app at the bundled Redis
service automatically.

```bash
docker compose up --build
```

The server is on `http://localhost:3000` (override with `PORT` in `.env`).
History is persisted to a named volume, so sessions survive `docker compose down`
and back up. To wipe everything including stored chats: `docker compose down -v`.

### Option B — Local Node + your own Redis

```bash
npm install
docker run -p 6379:6379 redis          # or point REDIS_URL at your own
npm start                              # reads .env via dotenv
```

### Web UI

Open **http://localhost:3000** for a minimal chat UI — a single self-contained
`public/index.html` (inline CSS + vanilla JS, no build step) that streams
responses from the server over SSE and remembers your session via `localStorage`.

Or talk to the API directly:

```bash
# A normal turn
curl -s localhost:3000/chat/alice \
  -H 'content-type: application/json' \
  -d '{"message":"What is the weather in Lisbon?"}' | jq

# Follow-up — it remembers the previous turn
curl -s localhost:3000/chat/alice \
  -H 'content-type: application/json' \
  -d '{"message":"And is that warmer than yesterday?"}' | jq

# Stream tokens over SSE
curl -N localhost:3000/chat/alice/stream \
  -H 'content-type: application/json' \
  -d '{"message":"Tell me a short story about that city."}'

# Inspect / reset
curl -s localhost:3000/chat/alice | jq
curl -s -X DELETE localhost:3000/chat/alice
```

## Environment

| Variable            | Default                    | Description                     |
| ------------------- | -------------------------- | ------------------------------- |
| `ANTHROPIC_API_KEY` | —                          | Required.                       |
| `REDIS_URL`         | `redis://localhost:6379`   | Redis connection string.        |
| `PORT`              | `3000`                     | HTTP port.                      |

## Adapting it

- **Swap providers** — replace `ClaudeAgent` with `OpenAiAgent`, `MistralAgent`,
  `OllamaAgent`, etc. The history format is provider-agnostic, so you can even
  resume a Claude conversation with OpenAI.
- **Auth** — derive `sessionId` from your auth middleware instead of the URL.
- **Compression instead of trimming** — attach a history compression plugin
  (`@agentionai/agents/history/plugins`) to summarize old turns rather than drop
  them.
