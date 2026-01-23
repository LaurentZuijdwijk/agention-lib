---
layout: home

hero:
  name: Agention
  text: Build AI Agents with TypeScript
  tagline: A modular library for creating LLM-powered agents, tools, and workflows
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/laurentzuijdwijk/agention-lib

features:
  - title: Multi-Provider Support
    details: Works with Claude, OpenAI, and Mistral out of the box. Switch providers without changing your code.
  - title: Tool System
    details: Define tools with JSON Schema validation. Agents automatically use tools to accomplish tasks.
  - title: Graph Pipelines
    details: Chain agents together with sequential, parallel, map, and voting patterns for complex workflows.
  - title: Type-Safe
    details: Full TypeScript support with strict typing, interfaces, and generics throughout.
---

## Quick Example

```typescript
import { ClaudeAgent } from '@agentionai/agents';

const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful assistant.',
});

const response = await agent.execute('What is the capital of France?');
console.log(response);
```

## Why Agention?

- **Simple API** - Get started with just a few lines of code
- **Flexible** - Use single agents or build complex multi-agent systems
- **Observable** - Built-in metrics and token tracking for monitoring
- **Extensible** - Create custom tools, agents, and pipeline nodes
