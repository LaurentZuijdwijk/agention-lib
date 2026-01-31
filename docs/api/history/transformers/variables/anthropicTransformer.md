# Variable: anthropicTransformer

> `const` **anthropicTransformer**: `object`

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
