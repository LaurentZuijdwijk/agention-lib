# Abstract Class: BaseExecutor\<TInput, TOutput\>

Defined in: [lib/graph/BaseExecutor.ts:46](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L46)

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

Defined in: [lib/graph/BaseExecutor.ts:50](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L50)

Display name for this executor

#### Implementation of

[`GraphNode`](../interfaces/GraphNode.md).[`name`](../interfaces/GraphNode.md#name)

***

### nodeType

> **nodeType**: [`GraphNodeType`](../type-aliases/GraphNodeType.md) = `"custom"`

Defined in: [lib/graph/BaseExecutor.ts:53](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L53)

Type of this node for metrics and visualization

#### Implementation of

[`GraphNode`](../interfaces/GraphNode.md).[`nodeType`](../interfaces/GraphNode.md#nodetype)

## Methods

### execute()

> `abstract` **execute**(`input`): `Promise`\<`TOutput`\>

Defined in: [lib/graph/BaseExecutor.ts:103](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L103)

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

Defined in: [lib/graph/BaseExecutor.ts:92](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L92)

Get collected metrics (if metrics collection is enabled).

#### Returns

[`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

***

### getMetricsCollector()

> **getMetricsCollector**(): [`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

Defined in: [lib/graph/BaseExecutor.ts:99](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L99)

Get the metrics collector instance.

#### Returns

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

***

### withMetrics()

> **withMetrics**(`collector?`): `this`

Defined in: [lib/graph/BaseExecutor.ts:64](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L64)

Enable metrics collection for this executor.

#### Parameters

##### collector?

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md)

#### Returns

`this`

***

### withName()

> **withName**(`name`): `this`

Defined in: [lib/graph/BaseExecutor.ts:73](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L73)

Set a custom name for this executor (used in metrics).

#### Parameters

##### name

`string`

#### Returns

`this`
