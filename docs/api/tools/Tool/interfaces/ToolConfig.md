# Interface: ToolConfig\<T\>

Defined in: [lib/tools/Tool.ts:20](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L20)

## Type Parameters

### T

`T`

## Properties

### context?

> `optional` **context**: `Record`\<`string`, `any`\>

Defined in: [lib/tools/Tool.ts:25](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L25)

***

### description

> **description**: `string`

Defined in: [lib/tools/Tool.ts:22](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L22)

***

### execute()

> **execute**: (`input`, `context?`) => `Promise`\<`T`\>

Defined in: [lib/tools/Tool.ts:24](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L24)

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

Defined in: [lib/tools/Tool.ts:23](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L23)

***

### name

> **name**: `string`

Defined in: [lib/tools/Tool.ts:21](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L21)
