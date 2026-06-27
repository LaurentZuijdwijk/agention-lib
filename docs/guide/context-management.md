# Context Management

Every agent conversation grows. System prompts, turns, tool results — it all accumulates in the context window. Left unmanaged, this creates real problems in production:

- **Token costs compound** — each call includes the full history; a 100-turn conversation can cost 10× a single-turn one
- **Quality degrades** — models perform worse when the context is bloated. Key information buried deep in the window gets ignored (the "lost in the middle" effect)
- **Tool results are often huge** — a single web search or file read can consume thousands of tokens, most of it irrelevant after the next turn
- **Context windows are hard limits** — exceed them and the API throws an error

Agention addresses this with a **history plugin system**: composable strategies that keep context lean without manual bookkeeping.

---

## Three Complementary Strategies

### Tool Result Masking — lossless, free

Large tool results are only fresh for a turn or two. After that they waste tokens without adding value.

`toolResultMaskingPlugin` replaces old results with a lightweight reference marker in the view the LLM sees, while keeping the full content in storage. Nothing is lost — the agent can retrieve any masked result on demand by calling the `retrieve_tool_result` tool.

| Property | Detail |
|---|---|
| Cost | Zero — sync, no LLM calls |
| Data loss | None — full content always retrievable |
| Trigger | Every `getEntries()` call, automatically |
| Cache | Masking mutates the prompt content seen by the LLM, which **breaks prompt caching** on providers that support it (e.g. Anthropic). Each time a result is newly masked, the changed prefix prevents a cache hit on subsequent API calls. This is a trade-off: you save tokens but may lose caching savings on multi-turn conversations. |

### Rolling Summarization — async, costs tokens

For conversation turns — the back-and-forth text — there's no equivalent of "just mask it." The model needs *some* memory of what was said. `compressionPlugin` compresses old turns into a concise summary using a fast, cheap model.

Compression is rolling: each pass incorporates the previous summary as context, so at most one summary entry exists at any time. The summary grows as the conversation does.

| Property | Detail |
|---|---|
| Cost | LLM tokens (use a cheap model like Haiku) |
| Data loss | Yes — detail is traded for brevity |
| Trigger | Explicit `history.reduce()` or automatic via `autoReduceWhen` |

### Sub-Agent Delegation — token isolation by architecture

When an agent uses another agent as a tool via `Tool.fromAgent()`, all of the sub-agent's internal work — its tool calls, large results, intermediate turns — stays inside the sub-agent's own history. The main agent receives only the final synthesized output as a single string tool result.

This is **token isolation by architecture**: the main agent's context never sees the expensive bulk work. Each sub-agent can have its own dedicated history with its own masking and compression plugins, tuned independently for its workload.

| Property | Detail |
|---|---|
| Cost | None — it's a structural choice |
| Data loss | None in the main context (sub-agent history is independent) |
| Trigger | Automatic — just use `Tool.fromAgent()` |

Use cheaper, faster models for sub-agents doing bulk work. The main agent sees only clean, synthesized results.

---

## Quick Setup

A runnable version of the example below is at [`examples/history-compression-example.ts`](https://github.com/laurentzuijdwijk/agention-lib/blob/master/examples/history-compression-example.ts).

### Masking only

Best for agents that call many tools with large results and whose conversation turns are short.

```typescript
import { toolResultMaskingPlugin } from '@agentionai/agents/history/plugins';
import { History } from '@agentionai/agents/history';
import { ClaudeAgent } from '@agentionai/agents/claude';

const maskingPlugin = toolResultMaskingPlugin({
  keepRecentResults: 2,    // keep last 2 results verbatim; mask everything older
  minTokensToMask: 100,    // don't bother masking tiny results
  exclude: ['calculator'], // always keep these verbatim regardless of age
});

const history = new History([], { maxTokens: 20000 });
history.use(maskingPlugin);

const agent = new ClaudeAgent(
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
    tools: [searchTool, calculatorTool, maskingPlugin.retrieveTool],
  },
  history
);
```

### Summarization only

Best for long multi-turn conversations with minimal tool use.

```typescript
import { compressionPlugin } from '@agentionai/agents/history/plugins';
import { History } from '@agentionai/agents/history';
import { ClaudeAgent } from '@agentionai/agents/claude';

// Use a fast, cheap model for summarization
const summaryAgent = new ClaudeAgent({
  id: 'summarizer',
  name: 'Summarizer',
  description: 'Summarize conversation history concisely.',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-haiku-4-5-20251001',
});

const history = new History()
  .use(compressionPlugin(summaryAgent, {
    autoReduceWhen: { maxTokens: 6000 }, // compress automatically when over budget
  }));

const agent = new ClaudeAgent(
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
  },
  history
);
// Summarization fires automatically — no manual reduce() needed
```

### Sub-agent delegation

Best when the expensive work — many tool calls, large retrievals, iterative research — can be encapsulated as a single operation from the main agent's perspective. Each sub-agent gets its own dedicated history with its own plugins.

```typescript
import { Tool } from '@agentionai/agents/core';
import { History } from '@agentionai/agents/history';
import { toolResultMaskingPlugin, compressionPlugin } from '@agentionai/agents/history/plugins';

// Sub-agent's own history — aggressively managed for its heavy workload
const researchHistory = new History([], { maxTokens: 30000 })
  .use(toolResultMaskingPlugin({ keepRecentResults: 1 }))
  .use(compressionPlugin(haiku, { autoReduceWhen: { maxTokens: 5000 } }));

// Cheap, fast model handles all the expensive bulk work
const researchAgent = new ClaudeAgent(
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Research a topic thoroughly and return a concise summary.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-haiku-4-5-20251001',
    tools: [webSearchTool, fileReaderTool],
  },
  researchHistory
);

// Wrap as a tool — main agent sees only the final summary string
const researchTool = Tool.fromAgent(
  researchAgent,
  'Research any topic in depth. Returns a concise summary of findings.'
);

// Main agent stays lean: no search results, no intermediate turns
const mainAgent = new ClaudeAgent(
  {
    id: 'coordinator',
    name: 'Coordinator',
    description: 'Coordinate research and produce final reports.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
    tools: [researchTool],
  },
  mainHistory
);
```

When the main agent calls `researchTool`, the sub-agent may make 10 searches, read 5 files, and have a 20-turn internal dialogue — all of that stays in `researchHistory`, invisible to the main agent. The main agent receives only the sub-agent's final synthesized answer.

For parallel bulk work, give each parallel sub-agent its own history instance:

```typescript
import { AgentGraph } from '@agentionai/agents/core';

function makeResearcher(topic: string) {
  const history = new History()
    .use(toolResultMaskingPlugin({ keepRecentResults: 1 }));
  return new ClaudeAgent(
    {
      id: `researcher-${topic}`,
      name: `Researcher ${topic}`,
      description: 'Research a topic and return findings.',
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: 'claude-haiku-4-5-20251001',
      tools: [webSearchTool],
    },
    history
  );
}

// Each parallel branch has its own isolated context
const researchers = AgentGraph.parallel(
  {},
  makeResearcher('quantum-computing'),
  makeResearcher('machine-learning'),
);
```

### All three combined (production agentic loops)

For long-running agents that accumulate both large tool results and many conversation turns, and delegate expensive work to sub-agents — the common production case.

```typescript
import { compressionPlugin, toolResultMaskingPlugin } from '@agentionai/agents/history/plugins';
import { History } from '@agentionai/agents/history';
import { ClaudeAgent } from '@agentionai/agents/claude';

const maskingPlugin = toolResultMaskingPlugin({
  keepRecentResults: 1,
  exclude: ['calculator'],
});

const summaryAgent = new ClaudeAgent({
  id: 'summarizer',
  name: 'Summarizer',
  description: 'Summarize conversation history concisely.',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-haiku-4-5-20251001',
});

const history = new History([], { maxTokens: 50000 })
  .use(maskingPlugin)
  .use(compressionPlugin(summaryAgent, {
    autoReduceWhen: { maxTokens: 8000 },
  }));

// Surface async plugin errors
history.on('pluginError', (error, _plugin, hook) => {
  console.error(`[${hook}]`, error.message);
});

const agent = new ClaudeAgent(
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
    tools: [searchTool, calculatorTool, maskingPlugin.retrieveTool],
  },
  history
);

// Run the conversation — both strategies fire automatically
await agent.execute('Research the latest developments in quantum computing.');
await agent.execute('Compare that to the state of the field in 2020.');
// ...
```

---

## How They Compose

All three strategies operate independently and reinforce each other:

```
Main agent context
┌──────────────────────────────────────────────────────┐
│  mainHistory                                         │
│  ├── toolResultMaskingPlugin (transform, read-time)  │
│  └── compressionPlugin (afterAdd → reduce)           │
│                                                      │
│  [turn 1] user: "Research quantum computing"         │
│  [turn 2] tool_use: researchTool(...)                │
│  [turn 2] tool_result: "Quantum computing has..."    │  ← one clean result
│  [turn 2] assistant: "Here's what I found..."        │
└──────────────────────────────────────────────────────┘
                              ▲
                              │ Tool.fromAgent()
                              │ returns final string only
┌──────────────────────────────────────────────────────┐
│  researchHistory (sub-agent's own context)            │
│  ├── toolResultMaskingPlugin (aggressive masking)    │
│  └── compressionPlugin (tight autoReduceWhen)        │
│                                                      │
│  [turn 1] tool_use: web_search("quantum 2025")       │
│  [turn 1] tool_result: [MASKED - ref: tu_001]        │  ← masked internally
│  [turn 2] tool_use: web_search("quantum hardware")   │
│  [turn 2] tool_result: "...8000 tokens of content"   │  ← recent: verbatim
│  ...10 more turns of research...                     │
│  [turn N] assistant: "Quantum computing has..."      │  ← this is returned
└──────────────────────────────────────────────────────┘
```

The plugins (masking and compression) manage context **within** a history instance. Sub-agent delegation manages context **between** agents — the main agent never sees the sub-agent's intermediate work.

For the plugins themselves, masking is **always on** — sync, read-time, no cost. Compression is **threshold-triggered** — async, fires when the budget is crossed, rewrites stored history. They do not interfere with each other.

---

## Sizing the Token Budget

A practical starting point for most production agents:

| History option | Recommended value | Reasoning |
|---|---|---|
| `History({ maxTokens })` | 50 000–100 000 | Hard FIFO drop guard — last resort |
| `autoReduceWhen.maxTokens` | 6 000–12 000 | Trigger compression well before the FIFO guard |
| `keepRecentResults` | 1–3 | How many tool results stay verbatim |
| `minTokensToMask` | 50–200 | Skip masking results that are already tiny |

Keep `autoReduceWhen.maxTokens` well below `History({ maxTokens })` so compression runs before the FIFO guard drops entries.

---

## Decision Guide

| Situation | Recommended approach |
|---|---|
| Agent calls tools returning large results | `toolResultMaskingPlugin` |
| Multi-turn conversation, minimal tools | `compressionPlugin` with `autoReduceWhen` |
| Production agentic loop | Both plugins with `autoReduceWhen` |
| Expensive bulk work (research, retrieval, crawling) | `Tool.fromAgent()` — isolate into a sub-agent with its own history |
| Sub-agent doing many tool calls | Give it its own `History` + `toolResultMaskingPlugin` |
| Parallel research across multiple topics | One sub-agent + dedicated history per topic |
| Need to inspect a masked result | `history.getToolResult(tool_use_id)` |
| Conversation must persist across restarts | `RedisHistory` + both plugins |
| Need to compress once at end of session | `await history.reduce({ maxTokens: N })` |

---

## Further Reading

- [History Management](/guide/history) — full API reference for `History`, `HistoryPlugin`, `ReduceOptions`, and all plugin options
- [History Management → Plugin System](/guide/history#plugin-system) — writing custom plugins
- [History Management → Built-in Plugins](/guide/history#built-in-plugins) — complete option tables for both plugins
- [Tools → Agent delegation](/guide/tools) — `Tool.fromAgent()` and agent-as-tool patterns
- [Graph Pipelines](/guide/graph-pipelines) — `ParallelExecutor` for concurrent sub-agent work
