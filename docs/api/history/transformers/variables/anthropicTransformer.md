# Variable: anthropicTransformer

> `const` **anthropicTransformer**: `object`

Defined in: [lib/history/transformers.ts:32](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/history/transformers.ts#L32)

## Type Declaration

### fromProviderContent()

> **fromProviderContent**(`role`, `content`): [`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

Convert Anthropic response content to normalized HistoryEntry

#### Parameters

##### role

`"user"` | `"assistant"`

##### content

`ContentBlock`[]

#### Returns

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

### getSystemMessage()

> **getSystemMessage**(`entries`): `string` \| `undefined`

Extract system message from entries

#### Parameters

##### entries

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)[]

#### Returns

`string` \| `undefined`

### toProvider()

> **toProvider**(`entries`): `MessageParam`[]

Convert normalized entries to Anthropic MessageParam format

#### Parameters

##### entries

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)[]

#### Returns

`MessageParam`[]
