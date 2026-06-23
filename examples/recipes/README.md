# Recipes

End-to-end, copy-pasteable starters that combine Agention's building blocks into
something you'd actually ship. Unlike the focused examples in `examples/`, each
recipe is a self-contained project with its own `package.json`.

| Recipe | What it shows | Stack |
| ------ | ------------- | ----- |
| [`hono-redis-chatbot/`](./hono-redis-chatbot) | A horizontally-scalable chat API. Per-session history lives in Redis, so the agent stays stateless. Includes an SSE streaming endpoint. | Hono · Redis · ClaudeAgent · History |
| [`research-agent/`](./research-agent) | An interactive terminal research assistant that web-searches, streams its reasoning, and saves Markdown reports. | readline · web search tool · streaming |
| [`ensemble-solver/`](./ensemble-solver) | Mixture-of-agents: several models each solve the same problem, then a judge synthesizes the best answer. | parallel · voting/judge · multi-provider |

Each folder has its own `README.md` with run instructions.

```bash
cd examples/recipes/<recipe>
npm install
npm start
```

## Ideas for more recipes

Contributions welcome. Good candidates that map onto existing features:

- **Slack / Discord bot** — same shape as the Hono recipe, but driven by an
  events webhook; key history by channel or thread.
- **RAG documentation Q&A** — ingest Markdown with the chunkers + a `VectorStore`,
  then answer questions with citations (`examples/ingestion-pipeline.ts` is a
  starting point).
- **Scheduled report generator** — a cron job that runs a pipeline and emails or
  posts a daily digest.
- **MCP-powered assistant** — wire up an MCP server (filesystem, GitHub, etc.)
  via `MCPClient` and let the agent use its tools.
- **Code-review team** — a `Team` / `AgentGraph.parallel` of reviewers (security,
  style, tests) whose findings are merged by a judge. (The inverse of
  `ensemble-solver`: many critics on one solution, rather than many authors.)
