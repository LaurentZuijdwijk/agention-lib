# Class: AgentGraph

Defined in: [lib/graph/AgentGraph.ts:60](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/AgentGraph.ts#L60)

Factory class for building agent graphs and workflows.
Provides static methods to create various execution patterns.

## Example

```typescript
// Simple sequential workflow
const workflow = AgentGraph.sequential(researchAgent, summaryAgent);

// Parallel experts with voting
const pipeline = AgentGraph.pipeline(
  AgentGraph.parallel({}, expertA, expertB, expertC),
  { execute: async (results) => ({ originalInput: query, solutions: results }) },
  AgentGraph.votingSystem(judgeAgent)
);
```

## Constructors

### Constructor

> **new AgentGraph**(): `AgentGraph`

#### Returns

`AgentGraph`

## Methods

### map()

> `static` **map**\<`TItem`, `TResult`\>(`processor`, `options`): [`MapExecutor`](../../MapExecutor/classes/MapExecutor.md)\<`TItem`, `TResult`\>

Defined in: [lib/graph/AgentGraph.ts:116](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/AgentGraph.ts#L116)

Creates a map executor that applies a processor to each item in an array.

#### Type Parameters

##### TItem

`TItem` = `string`

##### TResult

`TResult` = `string`

#### Parameters

##### processor

[`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md)\<`TItem`, `TResult`\>

GraphNode to apply to each item

##### options

[`MapExecutorOptions`](../../MapExecutor/interfaces/MapExecutorOptions.md) = `{}`

Configuration options

#### Returns

[`MapExecutor`](../../MapExecutor/classes/MapExecutor.md)\<`TItem`, `TResult`\>

MapExecutor instance

***

### parallel()

> `static` **parallel**(`options`, ...`agents`): [`ParallelExecutor`](../../ParallelExecutor/classes/ParallelExecutor.md)

Defined in: [lib/graph/AgentGraph.ts:87](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/AgentGraph.ts#L87)

Creates a parallel executor that runs agents concurrently.
All agents receive the same input and results are collected.

#### Parameters

##### options

[`ParallelExecutorOptions`](../../ParallelExecutor/interfaces/ParallelExecutorOptions.md) = `{}`

Configuration options

##### agents

...[`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)\<`unknown`, `unknown`\>[]

Agents to execute in parallel

#### Returns

[`ParallelExecutor`](../../ParallelExecutor/classes/ParallelExecutor.md)

ParallelExecutor instance

***

### pipeline()

> `static` **pipeline**\<`TInput`, `TOutput`\>(...`stages`): [`Pipeline`](../../Pipeline/classes/Pipeline.md)\<`TInput`, `TOutput`\>

Defined in: [lib/graph/AgentGraph.ts:130](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/AgentGraph.ts#L130)

Creates a pipeline that chains multiple graph nodes together.
Output of each stage becomes input to the next.

#### Type Parameters

##### TInput

`TInput` = `unknown`

##### TOutput

`TOutput` = `unknown`

#### Parameters

##### stages

...[`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md)\<`unknown`, `unknown`\>[]

GraphNodes to execute in sequence

#### Returns

[`Pipeline`](../../Pipeline/classes/Pipeline.md)\<`TInput`, `TOutput`\>

Pipeline instance

***

### router()

> `static` **router**(`router`, `routes`, `options`): [`RouterExecutor`](../../RouterExecutor/classes/RouterExecutor.md)

Defined in: [lib/graph/AgentGraph.ts:154](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/AgentGraph.ts#L154)

Creates a router executor that routes input to one of several handlers.
A router agent analyzes the input and selects the most appropriate route.

#### Parameters

##### router

[`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)

Agent that decides which route to select

##### routes

[`Route`](../../RouterExecutor/interfaces/Route.md)\<`string`, `string`\>[]

Array of available routes with names, descriptions, and handlers

##### options

[`RouterExecutorOptions`](../../RouterExecutor/interfaces/RouterExecutorOptions.md) = `{}`

Configuration options

#### Returns

[`RouterExecutor`](../../RouterExecutor/classes/RouterExecutor.md)

RouterExecutor instance

#### Example

```typescript
const router = AgentGraph.router(routerAgent, [
  { name: "technical", description: "Technical questions", handler: techAgent },
  { name: "general", description: "General questions", handler: generalAgent },
]);
const result = await router.execute("How do I fix this bug?");
```

***

### sequential()

#### Call Signature

> `static` **sequential**(...`agents`): [`SequentialExecutor`](../../SequentialExecutor/classes/SequentialExecutor.md)

Defined in: [lib/graph/AgentGraph.ts:68](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/AgentGraph.ts#L68)

Creates a sequential executor that chains agents together.
Output of each agent becomes input to the next.

##### Parameters

###### agents

...[`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)\<`unknown`, `unknown`\>[]

Agents to execute in sequence

##### Returns

[`SequentialExecutor`](../../SequentialExecutor/classes/SequentialExecutor.md)

SequentialExecutor instance

#### Call Signature

> `static` **sequential**(`options`, ...`agents`): [`SequentialExecutor`](../../SequentialExecutor/classes/SequentialExecutor.md)

Defined in: [lib/graph/AgentGraph.ts:69](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/AgentGraph.ts#L69)

Creates a sequential executor that chains agents together.
Output of each agent becomes input to the next.

##### Parameters

###### options

[`SequentialExecutorOptions`](../../SequentialExecutor/interfaces/SequentialExecutorOptions.md)

###### agents

...[`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)\<`unknown`, `unknown`\>[]

Agents to execute in sequence

##### Returns

[`SequentialExecutor`](../../SequentialExecutor/classes/SequentialExecutor.md)

SequentialExecutor instance

***

### votingSystem()

> `static` **votingSystem**(`judge`, `options`): [`VotingSystem`](../../VotingSystem/classes/VotingSystem.md)

Defined in: [lib/graph/AgentGraph.ts:102](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/AgentGraph.ts#L102)

Creates a voting system with a judge agent.
Used to select or synthesize the best answer from multiple solutions.

#### Parameters

##### judge

[`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)

Agent that will evaluate and select the best answer

##### options

[`VotingSystemOptions`](../../VotingSystem/interfaces/VotingSystemOptions.md) = `{}`

Configuration options

#### Returns

[`VotingSystem`](../../VotingSystem/classes/VotingSystem.md)

VotingSystem instance
