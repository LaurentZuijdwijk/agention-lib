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

User-defined metadata field definitions for filterable columns.
When specified, these fields are stored as typed Arrow columns enabling efficient filtering.
Chunk metadata fields (index, hash, prev_id, etc.) are handled automatically
via a `chunk_metadata` struct column and do not need to be listed here.
If not specified, the store connects to a pre-existing table.

> **Important:** Use `snake_case` for field names (e.g. `tenant_id`, not `tenantId`).
> LanceDB uses DataFusion for SQL filtering, which normalizes unquoted identifiers
> to lowercase. Mixed-case names will fail to match during filtering.

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
