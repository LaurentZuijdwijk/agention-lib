# Quickstart

Build a weather assistant with tools in 5 minutes.

## Prerequisites

- Node.js 18+
- An Anthropic API key (or OpenAI/Mistral)

## 1. Create a New Project

```bash
mkdir my-agent && cd my-agent
npm init -y
npm install @agentionai/agents @anthropic-ai/sdk
```

Set your API key:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

Get your API key from [console.anthropic.com](https://console.anthropic.com/)

## 2. Create a Simple Agent

Create `index.ts`:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-5',
  id: "assistant",
  name: "Assistant",
  description: "You are a helpful assistant.",
  tools: [],
});

async function main() {
  const response = await agent.execute('What can you help me with?');
  console.log(response);
}

main();
```

Run it:

```bash
ANTHROPIC_API_KEY=your-key npx ts-node index.ts
```

## 3. Add a Tool

Tools let agents perform actions. Let's add a weather tool:

```typescript
import { GeminiAgent, Tool } from '@agentionai/agents/gemini';

// Define a weather tool
const weatherTool = new Tool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  inputSchema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name, e.g. "London"',
      },
    },
    required: ['location'],
  },
  execute: async ({ location }) => {
    // In a real app, call a weather API
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
  name: "Weather agent",
  description: 'You are a weather assistant. Use the weather tool to answer questions',
  tools: [weatherTool],
});

async function main() {
  const response = await agent.execute("What's the weather in Paris?");
  console.log(response);
}

main();
```

The agent will automatically use the tool when needed.

## 4. Chain Agents Together

Use pipelines to create multi-step workflows:

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
});

const writer = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  id: 'writer',
  name: 'Writer',
  description: 'Write a short blog post based on the research provided.',
  model: 'claude-sonnet-4-5',
});

const pipeline = new Pipeline([researcher, writer]);

async function main() {
  const result = await pipeline.execute('Renewable energy trends in 2024');
  console.log(result.output);
}

main();
```

## Next Steps

- [Agents](/guide/agents) - Configure agents for different providers
- [Tools](/guide/tools) - Build more complex tools
- [Graph Pipelines](/guide/graph-pipelines) - Advanced workflow patterns
