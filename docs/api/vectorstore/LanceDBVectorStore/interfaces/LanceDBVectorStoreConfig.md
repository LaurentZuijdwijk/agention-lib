# Interface: LanceDBVectorStoreConfig

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:26](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L26)

Configuration for LanceDBVectorStore.

## Properties

### connectionOptions?

> `optional` **connectionOptions**: `Partial`\<`ConnectionOptions`\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:38](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L38)

Additional connection options

***

### dimensions?

> `optional` **dimensions**: `number`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:36](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L36)

Vector dimensions (required if no embeddings provider, defaults to embeddings.dimensions)

***

### embeddings?

> `optional` **embeddings**: [`Embeddings`](../../Embeddings/classes/Embeddings.md)

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:34](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L34)

Embeddings provider for automatic embedding generation

***

### name

> **name**: `string`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:28](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L28)

Name identifier for this store instance

***

### tableName

> **tableName**: `string`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:32](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L32)

Name of the table to use

***

### uri

> **uri**: `string`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:30](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L30)

URI for the LanceDB database (local path or cloud URI)
