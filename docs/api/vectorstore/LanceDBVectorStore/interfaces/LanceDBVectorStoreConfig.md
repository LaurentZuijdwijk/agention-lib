# Interface: LanceDBVectorStoreConfig

Configuration for LanceDBVectorStore.

## Properties

### connectionOptions?

> `optional` **connectionOptions**: `Partial`\<`ConnectionOptions`\>

Additional connection options

***

### dimensions?

> `optional` **dimensions**: `number`

Vector dimensions (required if no embeddings provider, defaults to embeddings.dimensions)

***

### embeddings?

> `optional` **embeddings**: [`Embeddings`](../../../embeddings/Embeddings/classes/Embeddings.md)

Embeddings provider for automatic embedding generation

***

### metadataFields?

> `optional` **metadataFields**: [`MetadataFieldDefinition`](MetadataFieldDefinition.md)[]

Metadata field definitions for filterable columns.
When specified, metadata fields are stored as separate columns enabling efficient filtering.
If not specified, metadata is stored as a JSON string (legacy behavior).

***

### name

> **name**: `string`

Name identifier for this store instance

***

### tableName

> **tableName**: `string`

Name of the table to use

***

### uri

> **uri**: `string`

URI for the LanceDB database (local path or cloud URI)
