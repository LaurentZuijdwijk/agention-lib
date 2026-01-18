# Agent Graph System

The graph module provides execution patterns for orchestrating multiple agents into workflows. It enables building complex pipelines where agents can work sequentially, in parallel, or in sophisticated multi-stage workflows.

## Core Concepts

### GraphNode Interface

All executors implement the `GraphNode` interface, making them composable:

```typescript
interface GraphNode<TInput = unknown, TOutput = unknown> {
  execute(input: TInput): Promise<TOutput>;
}
```

### Available Executors

| Executor | Description | Input | Output |
|----------|-------------|-------|--------|
| `SequentialExecutor` | Chains agents, passing output to next | `string` | `string` |
| `ParallelExecutor` | Runs agents concurrently on same input | `string` | `string[]` |
| `Pipeline` | Chains any GraphNodes together | Generic | Generic |
| `MapExecutor` | Applies processor to each array item | `T[]` | `R[]` |
| `VotingSystem` | Judge selects best from solutions | `VotingInput` | `string` |

## Usage

### AgentGraph Factory

The `AgentGraph` class provides static factory methods for creating executors:

```typescript
import { AgentGraph } from "@agentionai/agents";

// Create executors
const sequential = AgentGraph.sequential(agent1, agent2, agent3);
const parallel = AgentGraph.parallel({}, expertA, expertB, expertC);
const voting = AgentGraph.votingSystem(judgeAgent);
const mapper = AgentGraph.map(processorAgent);
const pipeline = AgentGraph.pipeline(stage1, stage2, stage3);
```

### Sequential Execution

Executes agents one after another, passing each agent's output to the next:

```typescript
const workflow = AgentGraph.sequential(
  researchAgent,
  analyzerAgent,
  summaryAgent
);

const result = await workflow.execute("What is quantum computing?");
// researchAgent runs first, its output goes to analyzerAgent,
// analyzerAgent's output goes to summaryAgent
```

**Options:**

```typescript
const workflow = AgentGraph.sequential(
  { wrapInput: false }, // Pass raw output instead of JSON wrapper
  agent1,
  agent2
);
```

By default, each agent receives:
```json
{
  "originalQuestion": "initial input",
  "resultFromPreviousAgent": "output from previous agent"
}
```

### Parallel Execution

Runs multiple agents concurrently on the same input:

```typescript
const experts = AgentGraph.parallel(
  {},
  economicsExpert,
  technologyExpert,
  socialExpert
);

const opinions = await experts.execute("Impact of AI on society");
// Returns: ["economics perspective...", "tech perspective...", "social perspective..."]
```

**Options:**

```typescript
const experts = AgentGraph.parallel(
  {
    isolatedExecution: true,  // Each agent works independently (default)
    wrapInput: false,         // Pass raw input instead of JSON wrapper
  },
  agent1,
  agent2
);
```

### Pipeline

Chains any `GraphNode` implementations together, enabling complex multi-stage workflows:

```typescript
const pipeline = AgentGraph.pipeline(
  AgentGraph.sequential(researchAgent, factChecker),
  AgentGraph.parallel({}, expertA, expertB),
  customTransformer,
  AgentGraph.votingSystem(judgeAgent)
);

const result = await pipeline.execute("Research question");
```

Pipelines can also be built incrementally:

```typescript
const pipeline = new Pipeline()
  .addStage(stage1)
  .addStage(stage2)
  .addStage(stage3);
```

### Map Executor

Applies a processor to each item in an array:

```typescript
const summarizer = AgentGraph.map(summaryAgent);

const summaries = await summarizer.execute([
  "Long document 1...",
  "Long document 2...",
  "Long document 3...",
]);
// Returns: ["Summary 1", "Summary 2", "Summary 3"]
```

**Options:**

```typescript
const mapper = AgentGraph.map(processor, {
  concurrency: 3, // Limit concurrent executions
});
```

### Voting System

Uses a judge agent to select or synthesize the best answer from multiple solutions:

```typescript
const voting = AgentGraph.votingSystem(judgeAgent);

const result = await voting.execute({
  originalInput: "What's the best programming language?",
  solutions: [
    "Python for its simplicity...",
    "Rust for its safety...",
    "JavaScript for its ubiquity...",
  ],
});
```

**Custom Prompt Template:**

```typescript
const voting = AgentGraph.votingSystem(judgeAgent, {
  promptTemplate: `
    Question: {originalQuestion}
    
    Candidates:
    {expertAnswers}
    
    Select the most accurate answer.
  `,
});
```

## Common Patterns

### Expert Panel with Voting

Multiple experts analyze a question, then a judge selects the best answer:

```typescript
const expertPanel = AgentGraph.pipeline(
  // Stage 1: Parallel expert analysis
  AgentGraph.parallel({}, expert1, expert2, expert3),
  
  // Stage 2: Transform results for voting
  {
    execute: async (results: string[]) => ({
      originalInput: question,
      solutions: results,
    }),
  },
  
  // Stage 3: Judge selects best answer
  AgentGraph.votingSystem(judgeAgent)
);

const verdict = await expertPanel.execute("Complex question here");
```

### Research Pipeline

Sequential research with fact-checking:

```typescript
const researchPipeline = AgentGraph.sequential(
  { wrapInput: false },
  researchAgent,      // Gather information
  factCheckerAgent,   // Verify claims
  summaryAgent        // Create final summary
);
```

### Batch Processing

Process multiple documents in parallel:

```typescript
const batchProcessor = AgentGraph.pipeline(
  // Split input into chunks (custom node)
  { execute: async (doc: string) => doc.split("\n\n") },
  
  // Process each chunk
  AgentGraph.map(chunkProcessor),
  
  // Combine results (custom node)
  { execute: async (chunks: string[]) => chunks.join("\n") }
);
```

### Hierarchical Analysis

Deep analysis with multiple levels:

```typescript
const deepAnalysis = AgentGraph.pipeline(
  // Initial analysis
  AgentGraph.sequential(researchAgent, initialAnalyzer),
  
  // Parallel deep dives
  AgentGraph.parallel({}, 
    technicalAnalyst,
    businessAnalyst,
    riskAnalyst
  ),
  
  // Synthesize findings
  { 
    execute: async (analyses: string[]) => ({
      originalInput: "Synthesize these analyses",
      solutions: analyses,
    })
  },
  
  AgentGraph.votingSystem(synthesisAgent)
);
```

## Type Safety

The graph system supports TypeScript generics for type-safe pipelines:

```typescript
// Type-safe pipeline
const pipeline = new Pipeline<string, number>();

pipeline.addStage({
  execute: async (input: string) => input.split(","),
});

pipeline.addStage({
  execute: async (input: string[]) => input.length,
});

const count: number = await pipeline.execute("a,b,c"); // 3
```

## Custom GraphNodes

Create custom nodes by implementing the `GraphNode` interface:

```typescript
const transformer: GraphNode<string[], VotingInput> = {
  execute: async (results) => ({
    originalInput: "Original question",
    solutions: results,
  }),
};

// Use in pipeline
const pipeline = AgentGraph.pipeline(
  parallelExperts,
  transformer,
  votingSystem
);
```

## Error Handling

Errors propagate through the pipeline and stop execution:

```typescript
try {
  const result = await pipeline.execute("input");
} catch (error) {
  // Handle error from any stage
  console.error("Pipeline failed:", error);
}
```

For more resilient workflows, wrap stages in try-catch:

```typescript
const resilientStage: GraphNode<string, string> = {
  execute: async (input) => {
    try {
      return await riskyAgent.execute(input);
    } catch (error) {
      return "Fallback response";
    }
  },
};
```
