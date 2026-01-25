---
layout: home

hero:
  name: Agention
  text: AI Agents Without the Magic
  tagline: No hidden state machines, no forced abstractions—just typed agents, composable graphs, persistent history, and real observability.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View Examples
      link: /guide/examples
    - theme: alt
      text: GitHub
      link: https://github.com/laurentzuijdwijk/agention-lib

features:
  - title: Multi-Provider, No Lock-in
    details: Claude, OpenAI, Gemini, Mistral—same interface. Mix providers in a single workflow. Switch models with one line.
  - title: Composable, Not Magical
    details: Agents are objects. Pipelines are arrays. No hidden state, no framework fighting, no surprises.
  - title: Full Observability
    details: Per-call token counts, execution timing, pipeline structure visualization. See exactly what's happening.
  - title: TypeScript-Native
    details: Strict typing, interfaces, and generics from the ground up. Not bolted on as an afterthought.
---

## The Problem with AI Frameworks

Most AI agent frameworks fall into two camps:

**Raw SDKs** give you control but you rebuild the same patterns every project—tool loops, history management, provider switching.

**Heavy frameworks** abstract everything away, but you lose visibility and fight the framework when you need control.

Agention is different: **enough structure to be productive, enough transparency to stay in control.**

From simple tool-calling agents to hierarchical RAG-powered research teams—build it your way.

## Core Building Blocks

### Agents
Unified interface across Claude, OpenAI, Gemini, and Mistral. Tools, history, and token tracking built-in.

```typescript
const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  tools: [searchTool, calculatorTool],
});
```
[Learn more →](/guide/agents)

### Tools
JSON Schema + handler pattern. Unique capability: wrap any agent as a tool for delegation hierarchies.

```typescript
// Use a specialized agent as a tool
const mainAgent = new ClaudeAgent({
  agents: [researchAssistant],  // Sub-agent becomes a callable tool
  tools: [webSearchTool],
});
```
[Learn more →](/guide/tools)

### History
Provider-agnostic, persistent (Redis, file, custom), shareable across agents of different providers.

```typescript
const history = new RedisHistory(redis);
await history.load('conversation:user123');

// Both agents share the same conversation
const claude = new ClaudeAgent({ model: 'claude-sonnet-4-5' }, history);
const gpt = new OpenAiAgent({ model: 'gpt-4o' }, history);
```
[Learn more →](/guide/history)

### Graph Pipelines
Compose sequential, parallel, voting, routing, and nested graphs. Mix models and providers freely.

```typescript
const pipeline = new Pipeline([
  AgentGraph.parallel(researcher1, researcher2),  // Parallel research
  synthesizer,                                     // Sequential synthesis
  AgentGraph.votingSystem(judge),                 // Judge picks best
]);
```
[Learn more →](/guide/graph-pipelines)

### RAG Ready
LanceDB vector store, token-aware chunking, ingestion pipeline, and retrieval tools out of the box.

```typescript
const store = await LanceDBVectorStore.create({ embeddings, uri: './data' });
const searchTool = store.toRetrievalTool('Search knowledge base');

const agent = new ClaudeAgent({ tools: [searchTool] });
```
[Learn more →](/guide/vector-stores)

### Observability
Per-call and per-node token counts, duration metrics, full execution visibility.

```typescript
const metrics = new MetricsCollector();
await pipeline.execute(input, { metrics[vitepress] 1 dead link(s) found.
 });

console.log(metrics.getMetrics());
// { totalTokens: 4600, totalDuration: 3200, nodes: [...] }
```
[Learn more →](/guide/graph-pipelines#metrics--observability)

## Quick Start Example

A research pipeline with sub-agent delegation, multi-provider setup, and graph composition:

```typescript
import { ClaudeAgent, OpenAiAgent, Tool, Pipeline, AgentGraph } from '@agentionai/agents';

// Define a search tool
const searchTool = new Tool({
  name: 'web_search',
  description: 'Search the web for current information',
  input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  handler: async ({ query }) => fetchSearchResults(query),
});

// Research assistant (cheaper model for data gathering)
const researchAssistant = new OpenAiAgent({
  id: 'research-assistant',
  name: 'Research Assistant',
  description: 'Search and summarize information on topics.',
  model: 'gpt-4o-mini',
  tools: [searchTool],
});

// Lead researcher delegates to assistant, synthesizes findings
const researcher = new ClaudeAgent({
  id: 'researcher',
  name: 'Lead Researcher',
  description: 'Research topics thoroughly using your assistant.',
  model: 'claude-sonnet-4-5',
  agents: [researchAssistant],  // Assistant available as a tool
});

// Writer produces final output
const writer = new ClaudeAgent({
  id: 'writer',
  name: 'Writer',
  description: 'Write a clear, engaging summary from the research.',
  model: 'claude-sonnet-4-5',
});

// Compose into a pipeline
const pipeline = new Pipeline([researcher, writer]);
const result = await pipeline.execute('Latest developments in quantum computing');
```

**What this demonstrates:**
- **Agents as tools** — The researcher delegates to the assistant when needed
- **Multi-provider** — GPT-4o-mini for bulk searching, Claude for synthesis
- **Graph composition** — Extend to parallel branches, voting judges, or nested pipelines

[See more examples →](/guide/examples)

## Why Developers Choose Agention

| | Raw SDKs | Heavy Frameworks | Agention |
|---|---|---|---|
| **Control** | Full | Limited | Full |
| **Boilerplate** | High | Low | Low |
| **Transparency** | Full | Limited | Full |
| **Multi-provider** | Manual | Varies | Built-in |
| **TypeScript** | Varies | Often partial | Native |

- **Ship faster** — Stop rebuilding agent infrastructure for every project
- **Stay flexible** — Swap providers, mix models, customize everything
- **Keep control** — See exactly what's happening at every step
- **Scale confidently** — Built-in metrics, token tracking, and observability

## Installation

```bash
npm install @agentionai/agents
```

Install provider SDKs as needed:

```bash
npm install @anthropic-ai/sdk  # For Claude
npm install openai             # For OpenAI/GPT
```

[Get started →](/guide/getting-started)

## Documentation

- [Getting Started](/guide/getting-started) — Installation and first agent
- [Agents](/guide/agents) — Agent configuration and providers
- [Tools](/guide/tools) — Adding capabilities and agent delegation
- [History](/guide/history) — Conversation persistence and sharing
- [Graph Pipelines](/guide/graph-pipelines) — Multi-agent workflows
- [Vector Stores](/guide/vector-stores) — RAG and semantic search
- [Examples](/guide/examples) — Real-world implementations
