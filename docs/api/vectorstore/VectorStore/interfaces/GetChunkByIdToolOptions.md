# Interface: GetChunkByIdToolOptions

Defined in: [lib/vectorstore/VectorStore.ts:105](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L105)

Options for creating a get chunk by ID tool from a vector store.

## Properties

### includeMetadata?

> `optional` **includeMetadata**: `boolean`

Defined in: [lib/vectorstore/VectorStore.ts:111](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L111)

Whether to include document metadata in results

***

### namespace?

> `optional` **namespace**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:109](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L109)

Namespace to search in

***

### toolName?

> `optional` **toolName**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:107](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L107)

Custom name for the tool (defaults to `${storeName}_get_chunk`)
