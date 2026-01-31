# Graph Pipelines

The graph system lets you build complex workflows by combining agents and other nodes. It provides patterns for sequential processing, parallel execution, decision-making, and planning.

## Pipeline Basics

Combine agents and nodes into workflows using executors. For chaining agents, use `sequential`:

```typescript
import { AgentGraph } from '@agentionai/agents';
import { ClaudeAgent } from '@agentionai/agents';

const researcher = new ClaudeAgent({
  id: 'researcher',
  name: 'Researcher',
  description: 'Research the topic and list key facts.',
  model: 'claude-sonnet-4-20250514',
});

const writer = new ClaudeAgent({
  id: 'writer',
  name: 'Writer',
  description: 'Write a blog post from the research provided.',
  model: 'claude-sonnet-4-20250514',
});

const chain = AgentGraph.sequential(researcher, writer);
const result = await chain.execute('Artificial Intelligence in Healthcare');
```

## Executor Types

### SequentialExecutor

Chains agents in sequence. Each agent receives the previous agent's output:

```typescript
const chain = AgentGraph.sequential(researcher, writer, editor);
const result = await chain.execute('Topic to write about');
// researcher → writer → editor
```

### ParallelExecutor

Runs multiple agents simultaneously on the same input:

```typescript
const parallel = AgentGraph.parallel({}, optimist, pessimist, realist);
const results = await parallel.execute('Analyze this business proposal');
// Returns array of all agent responses
```

### MapExecutor

Applies an agent to each item in an array:

```typescript
const summarizer = new ClaudeAgent({
  id: 'summarizer',
  name: 'Summarizer',
  description: 'Summarize this article in 2 sentences.',
  model: 'claude-sonnet-4-20250514',
});

const mapper = AgentGraph.map(summarizer);
const articles = ['Article 1 text...', 'Article 2 text...', 'Article 3 text...'];
const summaries = await mapper.execute(articles);
// Returns array of summaries
```

### VotingSystem

Multiple agents propose solutions, then a judge selects the best:

```typescript
const voting = AgentGraph.votingSystem(techLead);
const result = await voting.execute({
  originalInput: 'Implement a caching solution',
  solutions: [juniorSolution, seniorSolution, architectSolution],
});
// Judge evaluates all proposals and picks the best
```

### RouterExecutor

Routes input to different agents based on content:

```typescript
const router = AgentGraph.router(classifierAgent, [
  { name: 'billing', handler: billingAgent, description: 'Billing questions' },
  { name: 'technical', handler: techAgent, description: 'Technical issues' },
  { name: 'general', handler: generalAgent, description: 'General inquiries' },
]);

const result = await router.execute('I need help with my invoice');
// Routes to billingAgent
```

### PlanExecutor

Orchestrates plan-based execution with separate planning and worker agents. The planning agent creates a plan, then worker agents execute each step. Supports concurrent step execution and enforces step limits.

```typescript
const planStore = AgentGraph.createPlanStore();
const contextStore = AgentGraph.createContextStore();

// Planning agent creates the plan
const planningAgent = new ClaudeAgent({
  id: 'planner',
  name: 'Planning Agent',
  description: 'Create a detailed execution plan with clear steps.',
  model: 'claude-sonnet-4-20250514',
  tools: AgentGraph.createPlanningTools(planStore),
});

// Worker agent executes individual steps
const workerAgent = new ClaudeAgent({
  id: 'worker',
  name: 'Worker Agent',
  description: 'Execute a single step and store results in context.',
  model: 'claude-sonnet-4-20250514',
  tools: AgentGraph.createContextTools(contextStore),
});

const executor = AgentGraph.planExecutor(planStore, planningAgent, workerAgent, {
  maxSteps: 10,           // Maximum steps to execute
  concurrency: 1,         // Run steps sequentially (1) or in parallel (>1)
  onPlanCreated: (goal, steps) => {
    console.log(`Plan: ${goal} with ${steps.length} steps`);
  },
  onStepComplete: (step, result, num) => {
    console.log(`Completed step ${num}: ${step.description}`);
  },
});

const finalOutput = await executor.execute('Research and summarize quantum computing');
// Returns clean finalOutput string for chaining

// Get detailed results
const details = executor.getLastResult();
console.log(details.completedSteps, details.totalSteps);
```

**Key Features:**
- **Separation of Concerns**: Planning and execution are separate phases
- **Concurrency Support**: Execute multiple independent steps in parallel
- **Step Limits**: `maxSteps` constrains both planning and execution
- **Graph Chaining**: Returns `finalOutput` string for pipeline integration
- **Detailed Results**: Use `getLastResult()` to access full execution details

**Use in Pipelines:**
```typescript
const planner = AgentGraph.planExecutor(planStore, planningAgent, workerAgent, {
  maxSteps: 5,
});

const summarizer = new ClaudeAgent({
  description: 'Create a summary from the plan results.',
  model: 'claude-sonnet-4-20250514',
});

// Chain PlanExecutor with other nodes
const pipeline = AgentGraph.pipeline(
  planner,
  AgentGraph.sequential(summarizer)
);

const result = await pipeline.execute('Build a feature roadmap');
```

## Shared Context

Share data between agents using a key-value context store accessed via tools:

```typescript
const contextStore = AgentGraph.createContextStore({ userId: '123' });

const researcher = new ClaudeAgent({
  id: 'researcher',
  name: 'Researcher',
  description: 'Research the topic and store findings in context.',
  model: 'claude-sonnet-4-20250514',
  tools: AgentGraph.createContextTools(contextStore),
});

const summarizer = new ClaudeAgent({
  id: 'summarizer',
  name: 'Summarizer',
  description: 'Get findings from context and create a summary.',
  model: 'claude-sonnet-4-20250514',
  tools: AgentGraph.createContextTools(contextStore),
});

// Researcher stores findings
await researcher.execute('Research quantum computing');
// Context now has: { research_findings: '...' }

// Summarizer retrieves and uses findings
await summarizer.execute('Summarize the research findings from context');
```

**Context Tools:**
- `context_get` - Get a value by key
- `context_set` - Store a value with a descriptive key
- `list_context_keys` - List all available keys
- `context_delete` - Delete a key

## Planning Tools

Enable agents to create and manage execution plans:

```typescript
const planStore = AgentGraph.createPlanStore();

const agent = new ClaudeAgent({
  id: 'planner',
  name: 'Planning Agent',
  description: 'Create a plan, then work through each step.',
  model: 'claude-sonnet-4-20250514',
  tools: AgentGraph.createPlanningTools(planStore),
});

await agent.execute('Create a plan to build a REST API');
// Agent creates plan with steps, works through them, marks complete
```

**Planning Tools:**
- `create_plan` - Create a plan with a goal and steps
- `view_plan` - View current plan status
- `get_next_step` - Get the next pending step
- `update_step` - Mark a step as completed/failed
- `add_step` - Add a new step to the plan

## Combining Context and Planning

Use both context and planning for sophisticated workflows:

```typescript
const contextStore = AgentGraph.createContextStore();
const planStore = AgentGraph.createPlanStore();

const planner = new ClaudeAgent({
  id: 'planner',
  description: 'Create a research plan.',
  model: 'claude-sonnet-4-20250514',
  tools: AgentGraph.createPlanningTools(planStore),
});

const researcher = new ClaudeAgent({
  id: 'researcher',
  description: 'Execute research steps and store findings in context.',
  model: 'claude-sonnet-4-20250514',
  tools: AgentGraph.createContextTools(contextStore),
});

const executor = AgentGraph.planExecutor(planStore, planner, researcher, {
  maxSteps: 10,
  onStepComplete: (step, result) => {
    console.log(`Completed: ${step.description}`);
  },
});

await executor.execute('Research AI safety and compile a report');

// Access results from context
const findings = contextStore.get('research_findings');
const report = contextStore.get('final_report');
```

## Agents with Tools in Pipelines

Each agent in a pipeline can have its own set of tools:

```typescript
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
  model: 'claude-sonnet-4-20250514',
  tools: [calculatorTool, chartGeneratorTool],
});

// Writer agent with no tools - pure text generation
const writer = new ClaudeAgent({
  id: 'writer',
  name: 'Writer',
  description: 'Write a compelling report based on the analysis.',
  model: 'claude-sonnet-4-20250514',
});

const pipeline = AgentGraph.sequential(researcher, analyst, writer);
```

**Why This Matters:**
- **Specialized capabilities** - Each agent has exactly the tools it needs
- **Tool isolation** - Agents can't accidentally use tools meant for other stages
- **Cost optimization** - Use cheaper models for data gathering, expensive models for synthesis

## Combining Executors

Executors are nodes themselves, so you can nest them:

```typescript
const researchPhase = AgentGraph.parallel({}, webSearcher, documentAnalyzer, expertConsult);

const synthesisPhase = AgentGraph.sequential(summarizer, factChecker);

const pipeline = AgentGraph.pipeline(researchPhase, synthesisPhase);
```

## Metrics & Observability

Track execution metrics across your pipeline:

```typescript
import { createMetricsCollector } from '@agentionai/agents';

const metrics = createMetricsCollector();
const chain = AgentGraph.sequential(researcher, writer).withMetrics(metrics);

const result = await chain.execute('Input');

console.log(metrics.getAggregateMetrics());
// {
//   totalDurationMs: 4523,
//   totalTokens: { inputTokens: 1200, outputTokens: 3400, totalTokens: 4600 },
//   nodeCount: 2,
//   successCount: 2,
//   failureCount: 0,
//   stages: [...]
// }
```

## Custom Nodes

Create custom nodes by implementing `GraphNode`:

```typescript
import { GraphNode } from '@agentionai/agents';

const dataFetcher: GraphNode<string, object> = {
  name: 'data-fetcher',
  nodeType: 'custom',
  async execute(url: string): Promise<object> {
    const response = await fetch(url);
    return response.json();
  },
};

// Use in pipelines
const pipeline = AgentGraph.pipeline(dataFetcher, analyzer);
```

## Factory Methods Summary

| Method | Description |
|--------|-------------|
| `AgentGraph.sequential(...agents)` | Chain agents in sequence |
| `AgentGraph.parallel(options, ...agents)` | Run agents in parallel |
| `AgentGraph.pipeline(...nodes)` | Chain any graph nodes |
| `AgentGraph.map(processor, options)` | Apply processor to array items |
| `AgentGraph.votingSystem(judge, options)` | Judge selects best solution |
| `AgentGraph.router(router, routes, options)` | Route to handlers |
| `AgentGraph.planExecutor(store, planner, worker, options)` | Orchestrate plan-based execution |
| `AgentGraph.createContextStore(initial)` | Create shared context |
| `AgentGraph.createContextTools(store)` | Get context tools |
| `AgentGraph.createPlanStore()` | Create plan store |
| `AgentGraph.createPlanningTools(store)` | Get planning tools |
