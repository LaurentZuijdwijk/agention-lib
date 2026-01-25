# Variable: anthropicTransformer

> `const` **anthropicTransformer**: `object`

Defined in: [lib/history/transformers.ts:34](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/history/transformers.ts#L34)

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
