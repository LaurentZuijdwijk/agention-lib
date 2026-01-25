---
layout: home

hero:
  name: Agention
  text: AI Agents Without the Magic
  tagline: Build multi-provider LLM workflows with full control. No black boxes, no vendor lock-in.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/laurentzuijdwijk/agention-lib

features:
  - title: No Vendor Lock-in
    details: Switch between Claude, OpenAI, Gemini, and Mistral with the same interface. Mix providers in a single workflow.
  - title: Composable, Not Magical
    details: Agents are objects. Pipelines are arrays. No hidden state, no framework fighting, no surprises.
  - title: Custom Reasoning Workflows
    details: Build your own reasoning patterns by composing specialized agents. Full visibility, full control.
  - title: TypeScript-Native
    details: Proper types throughout, not bolted on. Strict typing, interfaces, and generics from the ground up.
---

## The Problem with AI Frameworks

Most AI agent frameworks fall into two camps:

**Raw SDKs** give you control but you rebuild the same patterns every project—tool loops, history management, provider switching.

**Heavy frameworks** abstract everything away, but you lose visibility and fight the framework when you need control.

Agention is different: **enough structure to be productive, enough transparency to stay in control.**

## Quick Example

```typescript
import { ClaudeAgent, Tool, Pipeline } from '@agentionai/agents';

// Define a tool
const searchTool = new Tool({
  name: 'search',
  description: 'Search for information',
  input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  handler: async ({ query }) => fetchResults(query),
});

// Create agents with tools
const researcher = new ClaudeAgent({
  id: 'researcher',
  name: 'Researcher',
  description: 'Research the topic thoroughly.',
  model: 'claude-sonnet-4-5',
  tools: [searchTool],
});

const writer = new ClaudeAgent({
  id: 'writer',
  name: 'Writer',
  description: 'Write a clear summary from the research.',
  model: 'claude-sonnet-4-5',
});

// Compose into a pipeline
const pipeline = new Pipeline([researcher, writer]);
const result = await pipeline.execute('Latest developments in quantum computing');
```

## Why Developers Choose Agention

- **Ship faster** - Stop rebuilding agent infrastructure for every project
- **Stay flexible** - Swap providers, mix models, customize everything
- **Keep control** - See exactly what's happening at every step
- **Scale confidently** - Built-in metrics, token tracking, and observability
