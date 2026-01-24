# Agention

> A TypeScript library for building AI-powered agents, tools, and complex workflows

[![npm version](https://img.shields.io/npm/v/@agentionai/agents.svg)](https://www.npmjs.com/package/@agentionai/agents)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Agention provides a clean, modular architecture for working with LLMs from multiple providers. Build single-purpose agents or orchestrate complex multi-agent workflows with built-in tools, vector search, and document processing capabilities.

## Features

- **🤖 Multi-Provider Support** - Works with Claude, OpenAI, Mistral, and Google Gemini out of the box
- **🔧 Powerful Tool System** - Define tools with JSON Schema validation, agents use them automatically
- **🔀 Graph Pipelines** - Chain agents together with sequential, parallel, map, voting, and router patterns
- **💾 Vector Search** - Built-in LanceDB integration for semantic search and RAG applications
- **📄 Document Processing** - Intelligent chunking with token-aware splitting and metadata tracking
- **📊 Metrics & Observability** - Track tokens, timing, and pipeline execution
- **🔒 Type-Safe** - Full TypeScript support with strict typing throughout

## Installation

```bash
npm install @agentionai/agents
```

Install the SDK for your chosen LLM provider:

```bash
# For Claude
npm install @anthropic-ai/sdk

# For OpenAI
npm install openai

# For vector search (optional)
npm install @lancedb/lancedb apache-arrow
```

## Quick Start

### Basic Agent

```typescript
import { ClaudeAgent } from '@agentionai/agents';

const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful assistant.',
});

const response = await agent.execute('What is the capital of France?');
console.log(response);
```

### Agent with Tools

```typescript
import { ClaudeAgent, Tool } from '@agentionai/agents';

const calculator = new Tool({
  name: 'calculate',
  description: 'Perform mathematical calculations',
  input_schema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Math expression to evaluate' },
    },
    required: ['expression'],
  },
  handler: async ({ expression }) => {
    return String(eval(expression));
  },
});

const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful math assistant.',
  tools: [calculator],
});

const response = await agent.execute('What is 15% of 230?');
// Agent automatically uses the calculator tool
```

### Multi-Agent Pipeline

```typescript
import { Pipeline, ClaudeAgent, OpenAiAgent } from '@agentionai/agents';

// Research agent with search capabilities
const researcher = new OpenAiAgent({
  name: 'researcher',
  model: 'gpt-4o',
  systemPrompt: 'Research the topic thoroughly.',
  tools: [webSearchTool],
});

// Writing agent
const writer = new ClaudeAgent({
  name: 'writer',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'Write a compelling blog post from the research.',
});

// Chain them together
const pipeline = new Pipeline([researcher, writer]);
const result = await pipeline.execute('AI in Healthcare');
// researcher output → writer input → final blog post
```

### RAG with Vector Search

```typescript
import { ClaudeAgent, LanceDBVectorStore, OpenAIEmbeddings } from '@agentionai/agents';

// Setup vector store
const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });
const store = await LanceDBVectorStore.create({
  name: 'docs',
  uri: './data/vectors',
  tableName: 'knowledge',
  embeddings,
});

// Add documents
await store.addDocuments([
  { id: '1', content: 'Company policy on refunds...' },
  { id: '2', content: 'Technical documentation...' },
]);

// Create search tool
const searchTool = store.toRetrievalTool(
  'Search company knowledge base',
  { defaultLimit: 5 }
);

// Agent can search and answer
const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'Answer questions using the knowledge base.',
  tools: [searchTool],
});

const answer = await agent.execute('What is our refund policy?');
```

## Core Concepts

### Agents

Agents wrap LLM providers with a consistent interface. All agents support:

- Conversation history management
- Tool use
- Token tracking
- Pipeline integration

```typescript
import { ClaudeAgent, OpenAiAgent, MistralAgent, GeminiAgent } from '@agentionai/agents';

// Same interface, different providers
const claude = new ClaudeAgent({ model: 'claude-sonnet-4-20250514' });
const openai = new OpenAiAgent({ model: 'gpt-4o' });
const mistral = new MistralAgent({ model: 'mistral-large-latest' });
const gemini = new GeminiAgent({ model: 'gemini-2.0-flash' });
```

### Tools

Tools give agents abilities beyond text generation. Define them with JSON Schema:

```typescript
const weatherTool = new Tool({
  name: 'get_weather',
  description: 'Get current weather for a city',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    },
    required: ['city'],
  },
  handler: async ({ city, units }) => {
    const weather = await fetchWeather(city, units);
    return JSON.stringify(weather);
  },
});
```

**Advanced: Agents as Tools**

Use agents as tools for hierarchical workflows:

```typescript
// Specialized sub-agent
const researchAssistant = new OpenAiAgent({
  name: 'research-assistant',
  description: 'Expert at finding research papers',
  tools: [pubmedSearchTool],
  model: 'gpt-4o-mini',
});

// Main agent delegates to sub-agent
const mainAgent = new ClaudeAgent({
  name: 'coordinator',
  agents: [researchAssistant],  // Sub-agents available as tools
  model: 'claude-sonnet-4-20250514',
});
```

### Graph Pipelines

Build complex workflows by combining agents and executors:

#### Sequential Processing

```typescript
import { SequentialExecutor } from '@agentionai/agents';

const chain = new SequentialExecutor({
  name: 'content-pipeline',
  agents: [researcher, writer, editor],
});
// researcher → writer → editor
```

#### Parallel Execution

```typescript
import { ParallelExecutor } from '@agentionai/agents';

const parallel = new ParallelExecutor({
  name: 'multi-perspective',
  agents: [optimist, pessimist, realist],
});
// All run simultaneously on same input
```

#### Map Operations

```typescript
import { MapExecutor } from '@agentionai/agents';

const mapper = new MapExecutor({
  name: 'batch-process',
  processor: summarizer,
});

await mapper.execute(['doc1', 'doc2', 'doc3']);
// Applies summarizer to each document
```

#### Voting Systems

```typescript
import { VotingSystem } from '@agentionai/agents';

const voting = new VotingSystem({
  name: 'code-review',
  candidates: [juniorDev, seniorDev, architect],
  judge: techLead,
});
// Multiple solutions proposed, judge picks best
```

#### Router Patterns

```typescript
import { RouterExecutor } from '@agentionai/agents';

const router = new RouterExecutor({
  name: 'support-router',
  routes: [
    { name: 'billing', agent: billingAgent, description: 'Billing questions' },
    { name: 'technical', agent: techAgent, description: 'Technical issues' },
  ],
  routerAgent: classifierAgent,
});
// Routes input to appropriate agent
```

### Document Processing

#### Chunking Strategies

Split documents intelligently for RAG applications:

```typescript
import { RecursiveChunker, TokenChunker, TextChunker } from '@agentionai/agents';

// Semantic chunking (best for structured docs)
const recursiveChunker = new RecursiveChunker({
  chunkSize: 1000,
  chunkOverlap: 100,
  separators: ['\n\n', '\n', '. ', ' '],
});

// Token-aware chunking (best for LLM context limits)
const tokenChunker = new TokenChunker({
  chunkSize: 500,  // tokens, not characters
  chunkOverlap: 50,
});

// Simple character-based chunking
const textChunker = new TextChunker({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const chunks = await recursiveChunker.chunk(documentText, {
  sourceId: 'doc-123',
  metadata: { author: 'Alice' },
});
```

#### Ingestion Pipeline

Orchestrate chunking, embedding, and storage:

```typescript
import { IngestionPipeline, RecursiveChunker } from '@agentionai/agents';

const chunker = new RecursiveChunker({ chunkSize: 1000 });
const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });
const store = await LanceDBVectorStore.create({
  name: 'docs',
  uri: './data',
  tableName: 'chunks',
  embeddings,
});

const pipeline = new IngestionPipeline(chunker, embeddings, store);

const result = await pipeline.ingest(documentText, {
  sourceId: 'doc-001',
  batchSize: 50,
  onProgress: ({ phase, processed, total }) => {
    console.log(`${phase}: ${processed}/${total}`);
  },
});
```

### Metrics & Observability

Track performance across your pipelines:

```typescript
import { MetricsCollector } from '@agentionai/agents';

const metrics = new MetricsCollector();
const result = await pipeline.execute('Input', { metrics });

const stats = metrics.getMetrics();
console.log({
  totalDuration: stats.totalDuration,
  totalTokens: stats.totalInputTokens + stats.totalOutputTokens,
  nodeCount: stats.nodes.length,
});

// Per-node metrics
stats.nodes.forEach(node => {
  console.log(`${node.name}: ${node.duration}ms, ${node.tokens?.total} tokens`);
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Agention                              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Claude  │  │  OpenAI  │  │ Mistral  │  │  Gemini  │   │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │               │             │          │
│       └─────────────┴───────────────┴─────────────┘          │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │ BaseAgent │                            │
│                    │ Interface │                            │
│                    └─────┬─────┘                            │
│                          │                                   │
│       ┌──────────────────┼──────────────────┐              │
│       │                  │                  │              │
│  ┌────▼────┐       ┌─────▼─────┐     ┌─────▼─────┐       │
│  │  Tools  │       │ Pipelines │     │  History  │       │
│  └─────────┘       └───────────┘     └───────────┘       │
│       │                  │                                   │
│  ┌────▼────────────┐     │                                   │
│  │ Vector Stores   │     │                                   │
│  │  - LanceDB      │     │                                   │
│  │  - Embeddings   │     │                                   │
│  └─────────────────┘     │                                   │
│                          │                                   │
│       ┌──────────────────┼──────────────────┐              │
│       │                  │                  │              │
│  ┌────▼────┐       ┌─────▼─────┐     ┌─────▼─────┐       │
│  │Sequential│      │ Parallel  │     │   Router  │       │
│  │Executor  │      │ Executor  │     │  Executor │       │
│  └──────────┘      └───────────┘     └───────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Documentation

- **[Getting Started](docs/guide/getting-started.md)** - Installation and first steps
- **[Agents](docs/guide/agents.md)** - Agent configuration and providers
- **[Tools](docs/guide/tools.md)** - Creating and using tools
- **[Graph Pipelines](docs/guide/graph-pipelines.md)** - Building multi-agent workflows
- **[Vector Stores](docs/guide/vector-stores.md)** - Semantic search and RAG
- **[Chunking & Ingestion](docs/guide/chunking-and-ingestion.md)** - Document processing
- **[Examples](docs/guide/examples.md)** - Complete example applications
- **[API Reference](docs/api)** - Full API documentation

## Examples

See the [examples](examples) directory for complete working examples:

- **Basic Agents** - Simple agent usage with different providers
- **Tool Usage** - Agents with custom tools
- **Multi-Agent Pipelines** - Sequential, parallel, and voting patterns
- **RAG Applications** - Vector search and document retrieval
- **Document Ingestion** - Chunking and embedding pipelines
- **Graph-based RAG** - Advanced knowledge graph integration

## Development

### Commands

```bash
# Build
npm run build

# Test
npm test
npm run test:watch

# Linting
npm run lint
npm run lint:fix

# Documentation
npm run docs:dev      # Start docs dev server
npm run docs:build    # Build documentation
npm run docs:api      # Generate API docs

# Examples
npm run example       # Run example code
```

### Project Structure

```
agention-lib/
├── lib/
│   ├── agents/           # Agent implementations
│   │   ├── anthropic/    # Claude agent
│   │   ├── openai/       # OpenAI agent
│   │   ├── mistral/      # Mistral agent
│   │   ├── google/       # Gemini agent
│   │   └── BaseAgent.ts  # Abstract base class
│   ├── tools/            # Tool system
│   ├── history/          # Conversation management
│   ├── graph/            # Pipeline executors
│   │   ├── executors/    # Sequential, Parallel, Map, Voting, Router
│   │   ├── MetricsCollector.ts
│   │   └── Pipeline.ts
│   ├── chunking/         # Document chunking
│   │   ├── TextChunker.ts
│   │   ├── RecursiveChunker.ts
│   │   └── TokenChunker.ts
│   ├── ingestion/        # Ingestion pipeline
│   └── vectorstore/      # Vector store implementations
│       ├── LanceDBVectorStore.ts
│       └── embeddings/
├── examples/             # Example applications
├── docs/                 # Documentation
└── dist/                 # Build output
```

## Environment Variables

Set API keys as environment variables:

```bash
# LLM Providers
export ANTHROPIC_API_KEY=your-key-here
export OPENAI_API_KEY=your-key-here
export MISTRAL_API_KEY=your-key-here
export GOOGLE_API_KEY=your-key-here
```

## Contributing

Contributions are welcome! Please see our development guidelines in [CLAUDE.md](CLAUDE.md).

## License

MIT

## Roadmap

- [ ] Streaming response support
- [ ] Additional vector store integrations (Pinecone, Weaviate)
- [ ] Conditional and loop executors
- [ ] Graph visualization tools
- [ ] Enhanced retry mechanisms
- [ ] Middleware system for request/response processing

## Support

- **Issues**: [GitHub Issues](https://github.com/laurentzuijdwijk/agention-lib/issues)
- **Documentation**: [docs](docs/guide/getting-started.md)
- **Examples**: [examples](examples)
