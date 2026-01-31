# Abstract Class: BaseExecutor\<TInput, TOutput\>

Base class for executors that implement the GraphNode interface.
Provides a foundation for building type-safe graph executors with optional metrics.

## Extended by

- [`MapExecutor`](../../MapExecutor/classes/MapExecutor.md)
- [`ParallelExecutor`](../../ParallelExecutor/classes/ParallelExecutor.md)
- [`Pipeline`](../../Pipeline/classes/Pipeline.md)
- [`RouterExecutor`](../../RouterExecutor/classes/RouterExecutor.md)
- [`SequentialExecutor`](../../SequentialExecutor/classes/SequentialExecutor.md)
- [`VotingSystem`](../../VotingSystem/classes/VotingSystem.md)

## Type Parameters

### TInput

`TInput` = `unknown`

### TOutput

`TOutput` = `unknown`

## Implements

- [`GraphNode`](../interfaces/GraphNode.md)\<`TInput`, `TOutput`\>

## Constructors

### Constructor

> **new BaseExecutor**\<`TInput`, `TOutput`\>(): `BaseExecutor`\<`TInput`, `TOutput`\>

#### Returns

`BaseExecutor`\<`TInput`, `TOutput`\>

## Properties

### name

> **name**: `string`

Display name for this executor

#### Implementation of

[`GraphNode`](../interfaces/GraphNode.md).[`name`](../interfaces/GraphNode.md#name)

***

### nodeType

> **nodeType**: [`GraphNodeType`](../type-aliases/GraphNodeType.md) = `"custom"`

Type of this node for metrics and visualization

#### Implementation of

[`GraphNode`](../interfaces/GraphNode.md).[`nodeType`](../interfaces/GraphNode.md#nodetype)

## Methods

### execute()

> `abstract` **execute**(`input`): `Promise`\<`TOutput`\>

#### Parameters

##### input

`TInput`

#### Returns

`Promise`\<`TOutput`\>

#### Implementation of

[`GraphNode`](../interfaces/GraphNode.md).[`execute`](../interfaces/GraphNode.md#execute)

***

### getMetrics()

> **getMetrics**(): [`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

Get collected metrics (if metrics collection is enabled).

#### Returns

[`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

***

### getMetricsCollector()

> **getMetricsCollector**(): [`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

Get the metrics collector instance.

#### Returns

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

***

### withMetrics()

> **withMetrics**(`collector?`): `this`

Enable metrics collection for this executor.

#### Parameters

##### collector?

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md)

#### Returns

`this`

***

### withName()

> **withName**(`name`): `this`

Set a custom name for this executor (used in metrics).

#### Parameters

##### name

`string`

#### Returns

`this`
