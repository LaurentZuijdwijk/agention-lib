# Interface: ToolConfig\<T\>

## Type Parameters

### T

`T`

## Properties

### context?

> `optional` **context**: `Record`\<`string`, `any`\>

***

### description

> **description**: `string`

***

### execute()

> **execute**: (`input`, `context?`) => `Promise`\<`T`\>

#### Parameters

##### input

`any`

##### context?

`Record`\<`string`, `any`\> | `null`

#### Returns

`Promise`\<`T`\>

***

### inputSchema

> **inputSchema**: [`ToolInputSchema`](ToolInputSchema.md)

***

### name

> **name**: `string`
