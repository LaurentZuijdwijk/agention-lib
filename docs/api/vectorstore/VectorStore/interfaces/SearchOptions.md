# Interface: SearchOptions

Options for searching the vector store.

## Properties

### filter?

> `optional` **filter**: `Record`\<`string`, `unknown`\>

Metadata filters to apply

***

### limit?

> `optional` **limit**: `number`

Maximum number of results to return

***

### namespace?

> `optional` **namespace**: `string`

Namespace or collection to search in

***

### scoreThreshold?

> `optional` **scoreThreshold**: `number`

Minimum similarity score threshold (0-1)
