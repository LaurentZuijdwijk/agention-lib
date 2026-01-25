# Class: ParallelExecutor

Defined in: [lib/graph/ParallelExecutor.ts:34](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/ParallelExecutor.ts#L34)

Executes multiple agents in parallel on the same input.
Returns an array of results from all agents.

## Example

```typescript
const executor = new ParallelExecutor({}, expertA, expertB, expertC);
const results = await executor.execute("Analyze this data");
// results is string[] with each expert's response
```

## Extends

- [`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md)\<`string`, `string`[]\>

## Constructors

### Constructor

> **new ParallelExecutor**(`options`, ...`agents`): `ParallelExecutor`

Defined in: [lib/graph/ParallelExecutor.ts:38](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/ParallelExecutor.ts#L38)

#### Parameters

##### options

[`ParallelExecutorOptions`](../interfaces/ParallelExecutorOptions.md) = `{}`

##### agents

...[`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)\<`unknown`, `unknown`\>[]

#### Returns

`ParallelExecutor`

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`constructor`](../../BaseExecutor/classes/BaseExecutor.md#constructor)

## Properties

### name

> **name**: `string`

Defined in: [lib/graph/BaseExecutor.ts:50](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L50)

Display name for this executor

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`name`](../../BaseExecutor/classes/BaseExecutor.md#name)

***

### nodeType

> **nodeType**: [`GraphNodeType`](../../BaseExecutor/type-aliases/GraphNodeType.md) = `"custom"`

Defined in: [lib/graph/BaseExecutor.ts:53](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L53)

Type of this node for metrics and visualization

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`nodeType`](../../BaseExecutor/classes/BaseExecutor.md#nodetype)

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Defined in: [lib/graph/ParallelExecutor.ts:149](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/ParallelExecutor.ts#L149)

Returns the number of agents that will execute in parallel.

##### Returns

`number`

## Methods

### execute()

> **execute**(`input`): `Promise`\<`string`[]\>

Defined in: [lib/graph/ParallelExecutor.ts:54](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/ParallelExecutor.ts#L54)

Executes all agents in parallel with the same input.

#### Parameters

##### input

`string`

The input string to send to all agents

#### Returns

`Promise`\<`string`[]\>

Array of results from each agent

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`execute`](../../BaseExecutor/classes/BaseExecutor.md#execute)

***

### getMetrics()

> **getMetrics**(): [`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

Defined in: [lib/graph/BaseExecutor.ts:92](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L92)

Get collected metrics (if metrics collection is enabled).

#### Returns

[`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`getMetrics`](../../BaseExecutor/classes/BaseExecutor.md#getmetrics)

***

### getMetricsCollector()

> **getMetricsCollector**(): [`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

Defined in: [lib/graph/BaseExecutor.ts:99](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L99)

Get the metrics collector instance.

#### Returns

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`getMetricsCollector`](../../BaseExecutor/classes/BaseExecutor.md#getmetricscollector)

***

### withMetrics()

> **withMetrics**(`collector?`): `this`

Defined in: [lib/graph/BaseExecutor.ts:64](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L64)

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

Defined in: [lib/graph/BaseExecutor.ts:73](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L73)

Set a custom name for this executor (used in metrics).

#### Parameters

##### name

`string`

#### Returns

`this`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`withName`](../../BaseExecutor/classes/BaseExecutor.md#withname)
