# Interface: AddDocumentsToolOptions

Defined in: [lib/vectorstore/VectorStore.ts:93](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L93)

Options for creating an add documents tool from a vector store.

## Properties

### defaultMetadata?

> `optional` **defaultMetadata**: `Record`\<`string`, `unknown`\>

Defined in: [lib/vectorstore/VectorStore.ts:99](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L99)

Default metadata to add to all documents (e.g., { projectId: "123", tenantId: "acme" })

***

### namespace?

> `optional` **namespace**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:97](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L97)

Namespace to add documents to

***

### toolName?

> `optional` **toolName**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:95](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L95)

Custom name for the tool (defaults to `${storeName}_add`)
