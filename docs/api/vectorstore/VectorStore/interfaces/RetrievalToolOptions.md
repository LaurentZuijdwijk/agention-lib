# Interface: RetrievalToolOptions

Options for creating a retrieval tool from a vector store.

## Properties

### allowFilterOverride?

> `optional` **allowFilterOverride**: `boolean`

Whether to allow the agent to override filters via tool parameters

***

### defaultFilter?

> `optional` **defaultFilter**: `Record`\<`string`, `unknown`\>

Default filters to apply (e.g., { projectId: "123", tenantId: "acme" })

***

### defaultLimit?

> `optional` **defaultLimit**: `number`

Default number of results to return

***

### defaultScoreThreshold?

> `optional` **defaultScoreThreshold**: `number`

Default score threshold

***

### includeMetadata?

> `optional` **includeMetadata**: `boolean`

Whether to include document metadata in results

***

### namespace?

> `optional` **namespace**: `string`

Namespace to search in

***

### toolName?

> `optional` **toolName**: `string`

Custom name for the tool (defaults to `${storeName}_search`)
