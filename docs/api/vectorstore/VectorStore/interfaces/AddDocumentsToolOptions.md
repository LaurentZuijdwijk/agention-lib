# Interface: AddDocumentsToolOptions

Options for creating an add documents tool from a vector store.

## Properties

### defaultMetadata?

> `optional` **defaultMetadata**: `Record`\<`string`, `unknown`\>

Default metadata to add to all documents (e.g., { projectId: "123", tenantId: "acme" })

***

### namespace?

> `optional` **namespace**: `string`

Namespace to add documents to

***

### toolName?

> `optional` **toolName**: `string`

Custom name for the tool (defaults to `${storeName}_add`)
