# Class: MapExecutor\<TItem, TResult\>

Defined in: [lib/graph/MapExecutor.ts:25](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/MapExecutor.ts#L25)

Maps a processor over each item in an array of inputs.
Similar to Array.map but for async GraphNode processing.

## Example

```typescript
const mapper = new MapExecutor(summaryAgent);
const summaries = await mapper.execute(["doc1", "doc2", "doc3"]);
```

## Extends

- [`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md)\<`TItem`[], `TResult`[]\>

## Type Parameters

### TItem

`TItem` = `string`

### TResult

`TResult` = `string`

## Constructors

### Constructor

> **new MapExecutor**\<`TItem`, `TResult`\>(`processor`, `options`): `MapExecutor`\<`TItem`, `TResult`\>

Defined in: [lib/graph/MapExecutor.ts:32](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/MapExecutor.ts#L32)

#### Parameters

##### processor

[`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md)\<`TItem`, `TResult`\>

##### options

[`MapExecutorOptions`](../interfaces/MapExecutorOptions.md) = `{}`

#### Returns

`MapExecutor`\<`TItem`, `TResult`\>

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`constructor`](../../BaseExecutor/classes/BaseExecutor.md#constructor)

## Properties

### name

> **name**: `string`

Defined in: [lib/graph/BaseExecutor.ts:50](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L50)

Display name for this executor

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`name`](../../BaseExecutor/classes/BaseExecutor.md#name)

***

### nodeType

> **nodeType**: [`GraphNodeType`](../../BaseExecutor/type-aliases/GraphNodeType.md) = `"custom"`

Defined in: [lib/graph/BaseExecutor.ts:53](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L53)

Type of this node for metrics and visualization

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`nodeType`](../../BaseExecutor/classes/BaseExecutor.md#nodetype)

## Methods

### execute()

> **execute**(`input`): `Promise`\<`TResult`[]\>

Defined in: [lib/graph/MapExecutor.ts:49](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/MapExecutor.ts#L49)

Processes each item in the input array through the processor.

#### Parameters

##### input

`TItem`[]

Array of items to process

#### Returns

`Promise`\<`TResult`[]\>

Array of processed results

#### Throws

Error if input is not an array

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`execute`](../../BaseExecutor/classes/BaseExecutor.md#execute)

***

### getMetrics()

> **getMetrics**(): [`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

Defined in: [lib/graph/BaseExecutor.ts:92](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L92)

Get collected metrics (if metrics collection is enabled).

#### Returns

[`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`getMetrics`](../../BaseExecutor/classes/BaseExecutor.md#getmetrics)

***

### getMetricsCollector()

> **getMetricsCollector**(): [`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

Defined in: [lib/graph/BaseExecutor.ts:99](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L99)

Get the metrics collector instance.

#### Returns

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`getMetricsCollector`](../../BaseExecutor/classes/BaseExecutor.md#getmetricscollector)

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

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`withMetrics`](../../BaseExecutor/classes/BaseExecutor.md#withmetrics)

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

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`withName`](../../BaseExecutor/classes/BaseExecutor.md#withname)
