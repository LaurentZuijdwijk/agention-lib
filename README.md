# Agention

> AI Agents Without the Magic

[![npm version](https://img.shields.io/npm/v/@agentionai/agents.svg)](https://www.npmjs.com/package/@agentionai/agents)

A comprehensive TypeScript toolkit for building LLM-powered agents with RAG, and multi-agent workflows. No hidden state machines, no forced abstractions—just typed agents, composable graphs, and complete control in a complete toolkit.

**[Documentation](https://docs.agention.ai/)** • **[Examples](https://docs.agention.ai/guide/examples)** • **[GitHub](https://github.com/laurentzuijdwijk/agention-lib)**

## Quick Start

### 1. Install

Install only what you need with selective imports:

```bash
# Install core library + Claude SDK
npm install @agentionai/agents @anthropic-ai/sdk
```

### 2. Get API Key

Get an API key from your chosen provider:

- **Claude**: [console.anthropic.com](https://console.anthropic.com/)
- **OpenAI**: [platform.openai.com](https://platform.openai.com/api-keys)
- **Gemini**: [aistudio.google.com](https://aistudio.google.com/app/apikey)
- **Mistral**: [console.mistral.ai](https://console.mistral.ai/)

Set it as an environment variable:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

### 3. Create Your First Agent

```typescript
// Import only Claude - no other agent SDKs required!
import { ClaudeAgent } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,  // Or pass directly (not recommended for production)
  model: 'claude-sonnet-4-5',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
});

const response = await agent.execute('What can you help me with?');
console.log(response);
```

### Selective Imports

Import only the agents you need:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';    // Requires @anthropic-ai/sdk
import { OpenAiAgent } from '@agentionai/agents/openai';    // Requires openai
import { GeminiAgent } from '@agentionai/agents/gemini';    // Requires @google/generative-ai
import { MistralAgent } from '@agentionai/agents/mistral';  // Requires @mistralai/mistralai
```

Or import everything (requires all SDKs):

```typescript
import { ClaudeAgent, OpenAiAgent } from '@agentionai/agents';
```


## Features

- **Multi-Provider, No Lock-in** - Claude, OpenAI, Gemini, Mistral—same interface. Switch models with one line.
- **Composable, Not Magical** - Agents are objects. Pipelines are arrays. No hidden state, no surprises.
- **Full Observability** - Per-call token counts, execution timing, pipeline structure visualization.
- **TypeScript-Native** - Strict typing, interfaces, and generics from the ground up.
- **RAG Ready** - LanceDB vector store, token-aware chunking, ingestion pipeline out of the box.


### Agent with Tools

```typescript
import { GeminiAgent, Tool } from '@agentionai/agents/gemini';

const weatherTool = new Tool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  input_schema: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
  handler: async ({ location }) => {
    // In production, call a weather API
    return JSON.stringify({
      location,
      temperature: 22,
      conditions: 'Sunny',
    });
  },
});

const agent = new GeminiAgent({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-flash-lite-latest',
  name: 'Weather Agent',
  description: 'You are a weather assistant.',
  tools: [weatherTool],
});

const response = await agent.execute("What's the weather in Paris?");
```

### Multi-Agent Pipeline

Chain agents together with different providers and models:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';
import { Pipeline } from '@agentionai/agents/core';

const researcher = new OpenAiAgent({
  apiKey: process.env.OPENAI_API_KEY,
  id: 'researcher',
  name: 'Researcher',
  description: 'Research the given topic and provide key facts.',
  model: 'gpt-4o',
  tools: [searchTool],
});

const writer = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  id: 'writer',
  name: 'Writer',
  description: 'Write a blog post based on the research provided.',
  model: 'claude-sonnet-4-5',
});

const pipeline = new Pipeline([researcher, writer]);
const result = await pipeline.execute('Renewable energy trends in 2024');
```

### Agent Delegation

Use agents as tools for hierarchical workflows:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';

// Research assistant (cheaper model for data gathering)
const researchAssistant = new OpenAiAgent({
  apiKey: process.env.OPENAI_API_KEY,
  id: 'research-assistant',
  name: 'Research Assistant',
  description: 'Search and summarize information on topics.',
  model: 'gpt-4o-mini',
  tools: [searchTool],
});

// Lead researcher delegates to assistant, synthesizes findings
const researcher = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  id: 'researcher',
  name: 'Lead Researcher',
  description: 'Research topics thoroughly using your assistant.',
  model: 'claude-sonnet-4-5',
  agents: [researchAssistant],  // Assistant available as a tool
});

const result = await researcher.execute('Latest developments in quantum computing');
```

## Core Concepts

### Agents
Unified interface across Claude, OpenAI, Gemini, and Mistral. Tools, history, and token tracking built-in.

[Learn more →](https://docs.agention.ai/guide/agents)

### Tools
JSON Schema + handler pattern. Unique capability: wrap any agent as a tool for delegation hierarchies.

[Learn more →](https://docs.agention.ai/guide/tools)

### History
Provider-agnostic, persistent (Redis, file, custom), shareable across agents of different providers.

[Learn more →](https://docs.agention.ai/guide/history)

### Graph Pipelines
Compose sequential, parallel, voting, routing, and nested graphs. Mix models and providers freely.

[Learn more →](https://docs.agention.ai/guide/graph-pipelines)

### RAG & Vector Stores
LanceDB vector store, token-aware chunking, ingestion pipeline, and retrieval tools out of the box.

[Learn more →](https://docs.agention.ai/guide/vector-stores)

### Observability
Per-call and per-node token counts, duration metrics, full execution visibility.

[Learn more →](https://docs.agention.ai/guide/graph-pipelines#metrics--observability)

## Documentation

- **[Getting Started](https://docs.agention.ai/guide/getting-started)** - Installation and first agent
- **[Quick Start](https://docs.agention.ai/guide/quickstart)** - Build a weather assistant in 5 minutes
- **[Agents](https://docs.agention.ai/guide/agents)** - Agent configuration and providers
- **[Tools](https://docs.agention.ai/guide/tools)** - Adding capabilities and agent delegation
- **[Graph Pipelines](https://docs.agention.ai/guide/graph-pipelines)** - Multi-agent workflows
- **[Vector Stores](https://docs.agention.ai/guide/vector-stores)** - RAG and semantic search
- **[Examples](https://docs.agention.ai/guide/examples)** - Real-world implementations
- **[API Reference](https://docs.agention.ai/api)** - Full API documentation

## Why Agention?

|  | Raw SDKs | Heavy Frameworks | Agention |
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

## Examples

Check out the [examples](https://github.com/laurentzuijdwijk/agention-lib/tree/master/examples) directory for complete working examples:

- Basic agents with different providers
- Custom tools and agent delegation
- Sequential, parallel, and voting pipelines
- RAG applications with vector search
- Document ingestion and chunking

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Links

- **[Documentation](https://docs.agention.ai/)**
- **[GitHub](https://github.com/laurentzuijdwijk/agention-lib)**
- **[npm](https://www.npmjs.com/package/@agentionai/agents)**
- **[Issues](https://github.com/laurentzuijdwijk/agention-lib/issues)**
