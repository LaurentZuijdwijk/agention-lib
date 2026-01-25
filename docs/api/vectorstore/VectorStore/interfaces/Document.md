# Interface: Document

Defined in: [lib/vectorstore/VectorStore.ts:13](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L13)

Represents a document with its content and optional metadata.

## Extended by

- [`EmbeddedDocument`](EmbeddedDocument.md)

## Properties

### content

> **content**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:17](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L17)

The text content of the document

***

### id

> **id**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:15](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L15)

Unique identifier for the document

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [lib/vectorstore/VectorStore.ts:19](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L19)

Optional metadata associated with the document
