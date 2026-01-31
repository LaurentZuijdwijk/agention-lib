# Class: VotingSystem

A voting system that uses a judge agent to select or synthesize
the best answer from multiple solutions.

Typically used after a ParallelExecutor to evaluate multiple expert opinions.

## Example

```typescript
const voting = new VotingSystem(judgeAgent);
const result = await voting.execute({
  originalInput: "What is the best approach?",
  solutions: [expertA_answer, expertB_answer, expertC_answer]
});
```

## Extends

- [`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md)\<[`VotingInput`](../interfaces/VotingInput.md), `string`\>

## Constructors

### Constructor

> **new VotingSystem**(`judge`, `options`): `VotingSystem`

#### Parameters

##### judge

[`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)

##### options

[`VotingSystemOptions`](../interfaces/VotingSystemOptions.md) = `{}`

#### Returns

`VotingSystem`

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`constructor`](../../BaseExecutor/classes/BaseExecutor.md#constructor)

## Properties

### name

> **name**: `string`

Display name for this executor

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`name`](../../BaseExecutor/classes/BaseExecutor.md#name)

***

### nodeType

> **nodeType**: [`GraphNodeType`](../../BaseExecutor/type-aliases/GraphNodeType.md) = `"custom"`

Type of this node for metrics and visualization

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`nodeType`](../../BaseExecutor/classes/BaseExecutor.md#nodetype)

## Methods

### execute()

> **execute**(`input`): `Promise`\<`string`\>

Evaluates the solutions and returns the judge's verdict.

#### Parameters

##### input

Object containing originalInput and solutions array

`string` | [`VotingInput`](../interfaces/VotingInput.md)

#### Returns

`Promise`\<`string`\>

The judge's selected or synthesized answer

#### Throws

Error if input is a string (must be VotingInput object)

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

Set a custom name for this executor (used in metrics).

#### Parameters

##### name

`string`

#### Returns

`this`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`withName`](../../BaseExecutor/classes/BaseExecutor.md#withname)
