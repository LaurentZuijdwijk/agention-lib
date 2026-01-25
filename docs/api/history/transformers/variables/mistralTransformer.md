# Variable: mistralTransformer

> `const` **mistralTransformer**: `object`

Defined in: [lib/history/transformers.ts:298](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/history/transformers.ts#L298)

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
