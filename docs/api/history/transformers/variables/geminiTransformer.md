# Variable: geminiTransformer

> `const` **geminiTransformer**: `object`

## Type Declaration

### fromProviderContent()

> **fromProviderContent**(`role`, `parts`): [`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

Convert Gemini response parts to normalized HistoryEntry

#### Parameters

##### role

`"user"` | `"assistant"`

##### parts

`Part`[]

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

### toolResultEntry()

> **toolResultEntry**(`functionName`, `output`, `is_error?`): [`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

Create a tool result entry for Gemini

#### Parameters

##### functionName

`string`

##### output

`string`

##### is\_error?

`boolean`

#### Returns

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

### toProvider()

> **toProvider**(`entries`): `Content`[]

Convert normalized entries to Gemini Content format

#### Parameters

##### entries

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)[]

#### Returns

`Content`[]
