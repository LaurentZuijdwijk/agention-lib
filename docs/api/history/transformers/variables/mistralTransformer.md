# Variable: mistralTransformer

> `const` **mistralTransformer**: `object`

Defined in: [lib/history/transformers.ts:296](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/history/transformers.ts#L296)

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

> **toolResultEntry**(`tool_call_id`, `_name`, `output`): [`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

Create a tool result entry for Mistral

#### Parameters

##### tool\_call\_id

`string`

##### \_name

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
