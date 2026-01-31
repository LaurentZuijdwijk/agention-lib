# Class: Pipeline\<TInput, TOutput\>

Builds a pipeline of graph nodes that execute in sequence,
where the output of each stage becomes the input of the next.

Unlike SequentialExecutor which is specific to agents,
Pipeline can chain any GraphNode implementations together.

## Example

```typescript
const pipeline = new Pipeline(
  AgentGraph.sequential(researchAgent, factChecker),
  AgentGraph.parallel({}, expertA, expertB),
  customTransformer,
  AgentGraph.votingSystem(judgeAgent)
);
const result = await pipeline.execute("Research topic X");
```

## Extends

- [`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md)\<`TInput`, `TOutput`\>

## Type Parameters

### TInput

`TInput` = `unknown`

### TOutput

`TOutput` = `unknown`

## Implements

- [`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md)\<`TInput`, `TOutput`\>

## Constructors

### Constructor

> **new Pipeline**\<`TInput`, `TOutput`\>(...`stages`): `Pipeline`\<`TInput`, `TOutput`\>

#### Parameters

##### stages

...[`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md)\<`unknown`, `unknown`\>[]

#### Returns

`Pipeline`\<`TInput`, `TOutput`\>

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`constructor`](../../BaseExecutor/classes/BaseExecutor.md#constructor)

## Properties

### name

> **name**: `string`

Display name for this executor

#### Implementation of

[`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md).[`name`](../../BaseExecutor/interfaces/GraphNode.md#name)

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`name`](../../BaseExecutor/classes/BaseExecutor.md#name)

***

### nodeType

> **nodeType**: [`GraphNodeType`](../../BaseExecutor/type-aliases/GraphNodeType.md) = `"custom"`

Type of this node for metrics and visualization

#### Implementation of

[`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md).[`nodeType`](../../BaseExecutor/interfaces/GraphNode.md#nodetype)

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`nodeType`](../../BaseExecutor/classes/BaseExecutor.md#nodetype)

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Returns the number of stages in the pipeline.

##### Returns

`number`

## Methods

### addStage()

> **addStage**\<`TStageOutput`\>(`stage`): `Pipeline`\<`TInput`, `TStageOutput`\>

Adds a stage to the end of the pipeline.

#### Type Parameters

##### TStageOutput

`TStageOutput`

#### Parameters

##### stage

[`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md)\<`TOutput`, `TStageOutput`\>

The GraphNode to add

#### Returns

`Pipeline`\<`TInput`, `TStageOutput`\>

The pipeline instance for chaining

***

### execute()

> **execute**(`input`): `Promise`\<`TOutput`\>

Executes all stages in sequence.

#### Parameters

##### input

`TInput`

The initial input

#### Returns

`Promise`\<`TOutput`\>

The output from the final stage

#### Implementation of

[`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md).[`execute`](../../BaseExecutor/interfaces/GraphNode.md#execute)

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`execute`](../../BaseExecutor/classes/BaseExecutor.md#execute)

***

### getMetrics()

> **getMetrics**(): [`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

Get collected metrics (if metrics collection is enabled).

#### Returns

[`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`getMetrics`](../../BaseExecutor/classes/BaseExecutor.md#getmetrics)

***

### getMetricsCollector()

> **getMetricsCollector**(): [`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

Get the metrics collector instance.

#### Returns

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`getMetricsCollector`](../../BaseExecutor/classes/BaseExecutor.md#getmetricscollector)

***

### withMetrics()

> **withMetrics**(`collector?`): `this`

Enable metrics collection and return the pipeline for chaining.

#### Parameters

##### collector?

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md)

#### Returns

`this`

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`withMetrics`](../../BaseExecutor/classes/BaseExecutor.md#withmetrics)

***

### withName()

> **withName**(`name`): `this`

Set a custom name for this executor (used in metrics).

#### Parameters

##### name

`string`

#### Returns

`this`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`withName`](../../BaseExecutor/classes/BaseExecutor.md#withname)
