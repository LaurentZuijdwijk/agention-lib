# Interface: SearchOptions

Defined in: [lib/vectorstore/VectorStore.ts:51](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L51)

Options for searching the vector store.

## Properties

### filter?

> `optional` **filter**: `Record`\<`string`, `unknown`\>

Defined in: [lib/vectorstore/VectorStore.ts:59](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L59)

Metadata filters to apply

***

### limit?

> `optional` **limit**: `number`

Defined in: [lib/vectorstore/VectorStore.ts:53](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L53)

Maximum number of results to return

***

### namespace?

> `optional` **namespace**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:57](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L57)

Namespace or collection to search in

***

### scoreThreshold?

> `optional` **scoreThreshold**: `number`

Defined in: [lib/vectorstore/VectorStore.ts:55](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L55)

Minimum similarity score threshold (0-1)
