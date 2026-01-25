# Variable: openAiTransformer

> `const` **openAiTransformer**: `object`

Defined in: [lib/history/transformers.ts:148](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/history/transformers.ts#L148)

## Type Declaration

### fromProviderMessage()

> **fromProviderMessage**(`role`, `outputText`, `functionCalls?`): [`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

Convert OpenAI response to normalized HistoryEntry

#### Parameters

##### role

`"user"` | `"assistant"`

##### outputText

`string`

##### functionCalls?

`object`[]

#### Returns

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

### toolResultEntry()

> **toolResultEntry**(`call_id`, `output`, `is_error?`): [`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

Create a tool result entry from OpenAI function call output

#### Parameters

##### call\_id

`string`

##### output

`string`

##### is\_error?

`boolean`

#### Returns

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)

### toProvider()

> **toProvider**(`entries`): `ResponseInputItem`[]

Convert normalized entries to OpenAI ResponseInputItem format

#### Parameters

##### entries

[`HistoryEntry`](../../types/type-aliases/HistoryEntry.md)[]

#### Returns

`ResponseInputItem`[]
