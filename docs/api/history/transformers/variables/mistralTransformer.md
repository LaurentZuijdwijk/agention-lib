# Variable: mistralTransformer

> `const` **mistralTransformer**: `object`

## Type Declaration

### fromProviderMessage()

> **fromProviderMessage**(`message`): [`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

Convert Mistral response to normalized HistoryEntry

#### Parameters

##### message

`MistralResponseMessage`

#### Returns

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

### toolResultEntry()

> **toolResultEntry**(`tool_call_id`, `name`, `output`): [`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

Create a tool result entry for Mistral

#### Parameters

##### tool\_call\_id

`string`

##### name

`string`

##### output

`string`

#### Returns

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

### toProvider()

> **toProvider**(`entries`): `MistralMessage`[]

Convert normalized entries to Mistral message format

#### Parameters

##### entries

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)[]

#### Returns

`MistralMessage`[]
