# Graph Pipelines

The graph system lets you build complex workflows by combining agents and other nodes. It provides patterns for sequential processing, parallel execution, and decision-making.

## Pipeline Basics

A `Pipeline` chains nodes together, passing output from one to the next:

```typescript
import { Pipeline } from '@agentionai/agents/core';
import { ClaudeAgent } from '@agentionai/agents/claude';

const researcher = new ClaudeAgent({
  id: 'researcher',
  name: 'Researcher',
  description: 'Research the topic and list key facts.',
  model: 'claude-sonnet-4-5',
});

const writer = new ClaudeAgent({
  id: 'writer',
  name: 'Writer',
  description: 'Write a blog post from the research provided.',
  model: 'claude-sonnet-4-5',
});

const pipeline = new Pipeline([researcher, writer]);
const result = await pipeline.execute('Artificial Intelligence in Healthcare');
```

## Executor Types

### SequentialExecutor

Chains agents in sequence. Each agent receives the previous agent's output:

```typescript
import { SequentialExecutor } from '@agentionai/agents/core';

const chain = new SequentialExecutor({
  name: 'content-chain',
  agents: [researcher, writer, editor],
});

const result = await chain.execute('Topic to write about');
// researcher → writer → editor
```

### ParallelExecutor

Runs multiple agents simultaneously on the same input:

```typescript
import { ParallelExecutor } from '@agentionai/agents/core';

const parallel = new ParallelExecutor({
  name: 'multi-perspective',
  agents: [optimist, pessimist, realist],
});

const result = await parallel.execute('Analyze this business proposal');
// Returns array of all agent responses
```

### MapExecutor

Applies an agent to each item in an array:

```typescript
import { MapExecutor } from '@agentionai/agents/core';

const summarizer = new ClaudeAgent({
  id: 'summarizer',
  name: 'Summarizer',
  description: 'Summarize this article in 2 sentences.',
  model: 'claude-sonnet-4-5',
});

const mapper = new MapExecutor({
  name: 'batch-summarize',
  processor: summarizer,
});

const articles = ['Article 1 text...', 'Article 2 text...', 'Article 3 text...'];
const result = await mapper.execute(articles);
// Returns array of summaries
```

### VotingSystem

Multiple agents propose solutions, then a judge selects the best:

```typescript
import { VotingSystem } from '@agentionai/agents/core';

const voting = new VotingSystem({
  name: 'code-review',
  candidates: [juniorDev, seniorDev, architect],
  judge: techLead,
});

const result = await voting.execute('Implement a caching solution');
// Judge evaluates all proposals and picks the best
```

### RouterExecutor

Routes input to different agents based on content:

```typescript
import { RouterExecutor } from '@agentionai/agents/core';

const router = new RouterExecutor({
  name: 'support-router',
  routes: [
    { name: 'billing', agent: billingAgent, description: 'Billing questions' },
    { name: 'technical', agent: techAgent, description: 'Technical issues' },
    { name: 'general', agent: generalAgent, description: 'General inquiries' },
  ],
  routerAgent: classifierAgent,
});

const result = await router.execute('I need help with my invoice');
// Routes to billingAgent
```

## Agents with Tools in Pipelines

Each agent in a pipeline can have its own set of tools, enabling sophisticated workflows where different stages have different capabilities. This is one of the most powerful features of the graph system.

```typescript
import { Pipeline } from '@agentionai/agents/core';
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';

// Research agent with search tools
const researcher = new OpenAiAgent({
  id: 'researcher',
  name: 'Researcher',
  description: 'Research the topic thoroughly using available tools.',
  model: 'gpt-4o',
  tools: [webSearchTool, pubmedSearchTool, arxivSearchTool],
});

// Analysis agent with data tools
const analyst = new ClaudeAgent({
  id: 'analyst',
  name: 'Analyst',
  description: 'Analyze the research and extract insights.',
  model: 'claude-sonnet-4-5',
  tools: [calculatorTool, chartGeneratorTool],
});

// Writer agent with no tools - pure text generation
const writer = new ClaudeAgent({
  id: 'writer',
  name: 'Writer',
  description: 'Write a compelling report based on the analysis.',
  model: 'claude-sonnet-4-5',
});

const pipeline = new Pipeline([researcher, analyst, writer]);
```

### Why This Matters

- **Specialized capabilities** - Each agent has exactly the tools it needs
- **Mix providers** - Use the best model for each task (GPT-4 for search, Claude for writing)
- **Tool isolation** - Agents can't accidentally use tools meant for other stages
- **Cost optimization** - Use cheaper models with tools for data gathering, expensive models for synthesis

### Advanced: Agents Calling Sub-Agents

Agents can also have other agents as tools (via the `agents` property), creating hierarchical structures within your pipeline:

```typescript
// Sub-agent with specialized tools
const dataGatherer = new OpenAiAgent({
  id: 'data-gatherer',
  name: 'Data Gatherer',
  description: 'Gathers data from multiple sources.',
  model: 'gpt-4o-mini',
  tools: [apiTool, databaseTool, scrapingTool],
});

// Main agent can delegate to sub-agent
const orchestrator = new ClaudeAgent({
  id: 'orchestrator',
  name: 'Orchestrator',
  description: 'Coordinate data gathering and analysis.',
  model: 'claude-sonnet-4-5',
  agents: [dataGatherer],  // Available as a tool
  tools: [analysisTool],
});

// Use in a pipeline
const pipeline = new Pipeline([orchestrator, reportWriter]);
```

This creates workflows where agents can dynamically decide when to delegate to specialized sub-agents, combining the structure of pipelines with the flexibility of tool use.

## Combining Executors

Executors are nodes themselves, so you can nest them:

```typescript
const researchPhase = new ParallelExecutor({
  name: 'research',
  agents: [webSearcher, documentAnalyzer, expertConsult],
});

const synthesisPhase = new SequentialExecutor({
  name: 'synthesis',
  agents: [summarizer, factChecker],
});

const pipeline = new Pipeline([researchPhase, synthesisPhase]);
```

## Metrics & Observability

Track execution metrics across your pipeline:

```typescript
import { MetricsCollector } from '@agentionai/agents/core';

const metrics = new MetricsCollector();
const result = await pipeline.execute('Input', { metrics });

console.log(metrics.getMetrics());
// {
//   totalDuration: 4523,
//   totalInputTokens: 1200,
//   totalOutputTokens: 3400,
//   nodes: [
//     { name: 'researcher', duration: 2100, ... },
//     { name: 'writer', duration: 2423, ... },
//   ]
// }
```

## Custom Nodes

Create custom nodes by implementing `GraphNode`:

```typescript
import { GraphNode, ExecutionResult } from '@agentionai/agents/core';

class DataFetcher implements GraphNode<string, object> {
  name = 'data-fetcher';
  nodeType = 'custom' as const;

  async execute(url: string): Promise<ExecutionResult<object>> {
    const response = await fetch(url);
    const data = await response.json();
    return { output: data };
  }
}

// Use in pipelines
const pipeline = new Pipeline([dataFetcher, analyzer]);
```
