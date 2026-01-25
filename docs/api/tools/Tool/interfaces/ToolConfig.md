# Interface: ToolConfig\<T\>

Defined in: [lib/tools/Tool.ts:23](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L23)

## Type Parameters

### T

`T`

## Properties

### context?

> `optional` **context**: `Record`\<`string`, `any`\>

Defined in: [lib/tools/Tool.ts:28](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L28)

***

### description

> **description**: `string`

Defined in: [lib/tools/Tool.ts:25](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L25)

***

### execute()

> **execute**: (`input`, `context?`) => `Promise`\<`T`\>

Defined in: [lib/tools/Tool.ts:27](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L27)

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

Defined in: [lib/tools/Tool.ts:26](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L26)

***

### name

> **name**: `string`

Defined in: [lib/tools/Tool.ts:24](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L24)
