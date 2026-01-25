# Interface: GraphNode\<TInput, TOutput\>

Defined in: [lib/graph/BaseExecutor.ts:24](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L24)

Represents a node in the agent graph that can process inputs and produce outputs.
Uses generics for type-safe input/output handling.

## Type Parameters

### TInput

`TInput` = `unknown`

### TOutput

`TOutput` = `unknown`

## Properties

### name?

> `optional` **name**: `string`

Defined in: [lib/graph/BaseExecutor.ts:27](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L27)

Optional name for the node (used in metrics)

***

### nodeType?

> `optional` **nodeType**: [`GraphNodeType`](../type-aliases/GraphNodeType.md)

Defined in: [lib/graph/BaseExecutor.ts:29](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L29)

Type of the node (used in metrics and visualization)

## Methods

### execute()

> **execute**(`input`): `Promise`\<`TOutput`\>

Defined in: [lib/graph/BaseExecutor.ts:25](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L25)

#### Parameters

##### input

`TInput`

#### Returns

`Promise`\<`TOutput`\>
