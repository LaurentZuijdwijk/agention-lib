# Interface: GraphNode\<TInput, TOutput\>

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

Optional name for the node (used in metrics)

***

### nodeType?

> `optional` **nodeType**: [`GraphNodeType`](../type-aliases/GraphNodeType.md)

Type of the node (used in metrics and visualization)

## Methods

### execute()

> **execute**(`input`): `Promise`\<`TOutput`\>

#### Parameters

##### input

`TInput`

#### Returns

`Promise`\<`TOutput`\>
