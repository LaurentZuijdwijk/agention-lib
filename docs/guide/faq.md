# FAQ

## Installation & Setup

### Do I need to install all provider SDKs?

No. Agention uses optional peer dependencies. Install only the SDK for the provider(s) you use:

```bash
npm install @agentionai/agents @anthropic-ai/sdk    # Claude only
npm install @agentionai/agents openai               # OpenAI only
npm install @agentionai/agents @google/generative-ai # Gemini only
npm install @agentionai/agents @mistralai/mistralai  # Mistral only
```

Use the matching sub-path import so the other SDKs are never loaded:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
```

### Which sub-path should I import from?

| Sub-path | What it includes |
|---|---|
| `@agentionai/agents` | Everything — all agents, all utilities |
| `@agentionai/agents/core` | All utilities, no agent implementations |
| `@agentionai/agents/claude` | Core + `ClaudeAgent` + `anthropicTransformer` |
| `@agentionai/agents/openai` | Core + `OpenAiAgent` + `openAiTransformer` |
| `@agentionai/agents/mistral` | Core + `MistralAgent` + `mistralTransformer` |
| `@agentionai/agents/gemini` | Core + `GeminiAgent` + `geminiTransformer` |
| `@agentionai/agents/embeddings` | Embedding providers only |
| `@agentionai/agents/vectorstore` | Vector store + embeddings |
| `@agentionai/agents/mcp` | MCP client only |
| `@agentionai/agents/chunkers` | Chunkers only |
| `@agentionai/agents/ingestion` | Ingestion pipeline only |

### My TypeScript compiler can't resolve the sub-path imports

Make sure your `tsconfig.json` uses `moduleResolution: "node16"`, `"bundler"`, or `"nodenext"`. The `"node"` strategy (classic) does not support package `exports` maps.

```json
{
  "compilerOptions": {
    "moduleResolution": "node16",
    "module": "node16"
  }
}
```

If you're using a bundler like Vite, Webpack, or esbuild, they handle sub-path exports natively — no tsconfig changes needed beyond `"moduleResolution": "bundler"`.

---

## Agents

### Why does my agent not use any tools?

The most common reasons:

1. **Description mismatch** — the tool's `description` doesn't match the task. The LLM decides when to use tools based on descriptions alone. Make them specific and action-oriented.
2. **Too many tools** — with a large number of tools, the LLM may get confused. Start with fewer tools and add more as needed.
3. **Wrong output expected** — the agent may have answered from its training data instead of calling the tool. Try making it explicit in the agent's `description`: _"Always use the search tool to find current information, do not rely on your training data."_

### Can I use multiple providers in the same workflow?

Yes. All agents implement the same `BaseAgent` and `GraphNode` interface, so you can freely mix them in pipelines:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';
import { AgentGraph } from '@agentionai/agents/core';

const researcher = new OpenAiAgent({ ... });
const writer = new ClaudeAgent({ ... });

const pipeline = AgentGraph.sequential(researcher, writer);
```

### How do I keep conversation history between calls?

By default history is **transient** — it clears after each `execute()`. Pass a `History` instance to persist it:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { History } from '@agentionai/agents/core';

const history = new History();
const agent = new ClaudeAgent({ ... }, history);

await agent.execute('My name is Alice.');
await agent.execute('What is my name?'); // Remembers Alice
```

See [History Management](/guide/history) for Redis and custom storage backends.

### My agent's responses get worse in long conversations. How do I fix it?

This is the "lost in the middle" effect: models pay less attention to information buried deep in a large context. Two built-in strategies address it:

**Tool result masking** — large tool results (search results, file reads) are replaced with a lightweight reference marker after the first turn or two. The agent sees `[MASKED - ref: tu_001]` instead of the full content, keeping the context lean. It can retrieve any masked result on demand via the `retrieve_tool_result` tool.

**Rolling summarization** — old conversation turns are compressed into a concise summary by a fast, cheap model. The summary replaces the turns in the context window, preserving the gist without the bulk.

**Sub-agent delegation** — wrap expensive bulk work (research, crawling, large retrievals) in a sub-agent via `Tool.fromAgent()`. The sub-agent does all the heavy lifting in its own isolated history; the main agent receives only the final synthesized result.

```typescript
import { compressionPlugin, toolResultMaskingPlugin } from '@agentionai/agents/history/plugins';

const maskingPlugin = toolResultMaskingPlugin({ keepRecentResults: 2 });
const history = new History()
  .use(maskingPlugin)
  .use(compressionPlugin(summaryAgent, { autoReduceWhen: { maxTokens: 8000 } }));

const agent = new ClaudeAgent({
  tools: [searchTool, maskingPlugin.retrieveTool],
}, history);
```

See [Context Management](/guide/context-management) for a full guide.

### How do I track token usage?

After `execute()`, read `agent.lastTokenUsage`:

```typescript
await agent.execute('Summarize this document...');

const { inputTokens, outputTokens, totalTokens } = agent.lastTokenUsage ?? {};
```

For pipelines, use `MetricsCollector` — see [Graph Pipelines](/guide/graph-pipelines).

### What does `debug: true` do?

It logs each LLM request and response to the console. Useful during development, keep it off in production.

---

## Tools

### Can a tool call another agent?

Yes — use `Tool.fromAgent()`:

```typescript
const subAgent = new ClaudeAgent({ ... });
const agentTool = Tool.fromAgent(subAgent, 'Use this to analyse sentiment.');

const mainAgent = new ClaudeAgent({ ..., tools: [agentTool] });
```

The main agent will call the sub-agent as a tool when it decides it's appropriate.

### Can a tool cancel its own execution?

Yes. Listen for `ToolEvent.EXECUTE` and call `event.preventDefault()`:

```typescript
tool.on(ToolEvent.EXECUTE, (event) => {
  if (isBanned(event.input)) {
    event.preventDefault(); // Aborts the call; the agent gets an error message
  }
});
```

### My tool throws an error — will the agent crash?

No. Tool errors are caught and reported back to the agent as a string error message. The agent can then decide how to proceed (retry, use a different tool, inform the user). The `AgentEvent.TOOL_ERROR` event is also emitted so you can observe it.

---

## Graph Pipelines

### What's the difference between `SequentialExecutor` and `Pipeline`?

- **`SequentialExecutor`** chains agents: each agent receives the previous agent's string output as its input.
- **`Pipeline`** chains any `GraphNode` — agents, custom nodes, transformers — and can carry typed data through stages.

Use `SequentialExecutor` for simple agent chains; use `Pipeline` when you need custom transformation steps or typed data.

### How do I pass data between pipeline stages?

Use `ContextStore` to share key-value state across agents:

```typescript
const context = AgentGraph.createContextStore({ userId: '123' });
const tools = AgentGraph.createContextTools(context);

// Give the tools to any agent that needs to read/write shared state
const agent = new ClaudeAgent({ ..., tools });
```

### Can I stop a pipeline early on failure?

Yes. Pass `stopOnFailure: true` to `SequentialExecutor`:

```typescript
const pipeline = AgentGraph.sequential(
  { stopOnFailure: true },
  agent1, agent2, agent3
);
```

---

## MCP

### Do I need to install the MCP SDK separately?

Yes, it is an optional peer dependency:

```bash
npm install @modelcontextprotocol/sdk
```

### Can I connect to multiple MCP servers?

Yes. Create a separate `MCPClient` for each server and merge their tools:

```typescript
const fs = MCPClient.fromStdio({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] });
const search = MCPClient.fromUrl('https://my-search-server.com/mcp');

await Promise.all([fs.connect(), search.connect()]);

const agent = new ClaudeAgent({
  ...,
  tools: [...fs.getTools(), ...search.getTools()],
});
```

---

## TypeScript

### I get "Property X does not exist" errors on agent config

Make sure you're importing from the correct sub-path. Vendor-specific config options (e.g. `disableParallelToolUse` for Claude) live in `vendorConfig`:

```typescript
import { ClaudeAgent, AgentConfig } from '@agentionai/agents/claude';

const config: AgentConfig = {
  vendor: 'anthropic',
  vendorConfig: {
    anthropic: { disableParallelToolUse: true }
  },
  ...
};
```

### Why does `AgentGraph.sequential()` return `SequentialExecutor` instead of `BaseAgent`?

Executors implement `GraphNode`, not `BaseAgent`. They can be used inside other pipelines, but can't be passed to the `agents` array of an agent config. If you need an agent that wraps a pipeline, create a thin `ClaudeAgent` wrapper that calls the pipeline internally via a tool.

### What TypeScript version is required?

TypeScript 4.7 or later (for `package.json` exports map support in `moduleResolution: "node16"`). TypeScript 5.x is recommended.
