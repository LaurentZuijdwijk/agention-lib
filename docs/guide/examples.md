# Examples

Real-world examples demonstrating Agention's capabilities. All examples are available in the [`examples/`](https://github.com/laurentzuijdwijk/agention-lib/tree/main/examples) directory.

## Weather Assistant

A simple agent with tools that fetches weather data for any location.

**Demonstrates:** Tools, API integration, multi-step tool use

```typescript
import { MistralAgent, Tool } from '@agentionai/agents/mistral';

// Geocoding tool to convert city names to coordinates
const geoCodingTool = new Tool({
  name: 'geocodingTool',
  description: 'Convert a location name to coordinates',
  inputSchema: {
    type: 'object',
    properties: {
      term: { type: 'string', description: 'City or location name' },
    },
    required: ['term'],
  },
  execute: async ({ term }) => {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${term}&count=10`
    );
    return res.json();
  },
});

// Weather tool that uses coordinates
const weatherTool = new Tool({
  name: 'weatherTool',
  description: 'Get weather forecast for coordinates',
  inputSchema: {
    type: 'object',
    properties: {
      lat: { type: 'number', description: 'Latitude' },
      long: { type: 'number', description: 'Longitude' },
    },
    required: ['lat', 'long'],
  },
  execute: async ({ lat, long }) => {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&current=temperature_2m,wind_speed_10m`
    );
    return res.json();
  },
});

const weatherAgent = new MistralAgent({
  name: 'Weather Agent',
  description: 'Get weather for a location. Use geocoding first, then weather.',
  tools: [geoCodingTool, weatherTool],
  model: 'mistral-large-latest',
});

const result = await weatherAgent.execute('What is the weather in Paris?');
```

The agent automatically chains the tools: geocoding → weather lookup → formatted response.

[View full example →](https://github.com/laurentzuijdwijk/agention-lib/blob/main/examples/weather.ts)

---

## Deep Research

A multi-agent system for medical literature research using PubMed.

**Demonstrates:** Agents as tools, multi-provider setup, sequential pipelines, cost tracking

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';
import { AgentGraph } from '@agentionai/agents/core';

// Research assistant with PubMed tools (cheaper model for data gathering)
const researchAssistant = new OpenAiAgent({
  name: 'PubmedResearchAssistant',
  description: 'Search PubMed and summarize findings',
  tools: [pubmedSearchTool, pubmedAbstractTool],
  model: 'gpt-4o-mini',
});

// Planning agent creates research strategy
const planningAgent = new ClaudeAgent({
  name: 'Research Planner',
  description: 'Create a research plan for the given topic',
  model: 'claude-sonnet-4-20250514',
});

// Main researcher synthesizes findings (has access to assistant)
const mainResearcher = new ClaudeAgent({
  name: 'Medical Researcher',
  description: 'Conduct deep research using the assistant',
  agents: [researchAssistant],  // Assistant available as a tool
  model: 'claude-sonnet-4-20250514',
});

// Pipeline: Plan → Research
const pipeline = AgentGraph.sequential(planningAgent, mainResearcher);

const result = await pipeline.execute(
  'What are the latest treatments for Type 2 diabetes?'
);
```

This example shows:
- **Cost optimization** - GPT-4o-mini handles the bulk of API calls (searching)
- **Quality synthesis** - Claude handles planning and final synthesis
- **Agent delegation** - Main researcher calls the assistant when needed

[View full example →](https://github.com/laurentzuijdwijk/agention-lib/blob/main/examples/research-agents/)

---

## Graph Pipeline Demo

Interactive demo showcasing all executor types in the graph system.

**Demonstrates:** Sequential, Parallel, Map, Voting, Pipeline composition

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { AgentGraph } from '@agentionai/agents/core';

// Simple transformation agents
const uppercaseAgent = new ClaudeAgent({
  name: 'Uppercase',
  description: 'Convert input to uppercase',
  maxTokens: 100,
});

const excitedAgent = new ClaudeAgent({
  name: 'Excited',
  description: 'Add excitement with exclamation marks',
  maxTokens: 100,
});

const calmAgent = new ClaudeAgent({
  name: 'Calm',
  description: 'Make text calmer and relaxed',
  maxTokens: 100,
});

const judgeAgent = new ClaudeAgent({
  name: 'Judge',
  description: 'Pick the better version',
  maxTokens: 20,
});

// Sequential: chain transformations
const sequential = AgentGraph.sequential(uppercaseAgent, excitedAgent);
await sequential.execute('hello world');
// "hello world" → "HELLO WORLD" → "HELLO WORLD!!!"

// Parallel: get multiple perspectives
const parallel = AgentGraph.parallel(excitedAgent, calmAgent);
const [excited, calm] = await parallel.execute('The sun is shining');

// Map: process array items
const mapper = AgentGraph.map(uppercaseAgent);
await mapper.execute(['one', 'two', 'three']);
// ["ONE", "TWO", "THREE"]

// Voting: judge picks best
const voting = AgentGraph.votingSystem(judgeAgent);
await voting.execute({
  originalInput: 'Pick the better version',
  solutions: [excited, calm],
});

// Pipeline: combine everything
const pipeline = AgentGraph.pipeline(
  AgentGraph.parallel(excitedAgent, calmAgent),
  // Transform for voting
  { execute: async (results) => ({ originalInput: 'Pick best', solutions: results }) },
  voting
);
```

[View full example →](https://github.com/laurentzuijdwijk/agention-lib/blob/main/examples/graph/)

---

## Running Examples

```bash
# Clone the repo
git clone https://github.com/laurentzuijdwijk/agention-lib.git
cd agention-lib

# Install dependencies
npm install

# Set up environment variables
cp examples/.env.example examples/.env
# Edit .env with your API keys

# Run an example
npx ts-node examples/weather.ts
npx ts-node examples/graph/index.ts
npx ts-node examples/research-agents/deep-research.ts
```

## More Examples

| Example | Description | Key Features |
|---------|-------------|--------------|
| `weather.ts` | Weather lookup with tools | Tools, API integration |
| `graph/` | All graph executor types | Pipelines, parallel, voting |
| `research-agents/` | Medical literature research | Multi-agent, multi-provider |
| `software-team/` | AI development team | Team coordination |
| `pubmed.ts` | PubMed search tool | Tool implementation |
| `generative.ts` | Basic agent usage | Getting started |
