# Interface: RetrievalToolOptions

Defined in: [lib/vectorstore/VectorStore.ts:73](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L73)

Options for creating a retrieval tool from a vector store.

## Properties

### allowFilterOverride?

> `optional` **allowFilterOverride**: `boolean`

Defined in: [lib/vectorstore/VectorStore.ts:87](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L87)

Whether to allow the agent to override filters via tool parameters

***

### defaultFilter?

> `optional` **defaultFilter**: `Record`\<`string`, `unknown`\>

Defined in: [lib/vectorstore/VectorStore.ts:85](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L85)

Default filters to apply (e.g., { projectId: "123", tenantId: "acme" })

***

### defaultLimit?

> `optional` **defaultLimit**: `number`

Defined in: [lib/vectorstore/VectorStore.ts:77](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L77)

Default number of results to return

***

### defaultScoreThreshold?

> `optional` **defaultScoreThreshold**: `number`

Defined in: [lib/vectorstore/VectorStore.ts:79](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L79)

Default score threshold

***

### includeMetadata?

> `optional` **includeMetadata**: `boolean`

Defined in: [lib/vectorstore/VectorStore.ts:83](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L83)

Whether to include document metadata in results

***

### namespace?

> `optional` **namespace**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:81](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L81)

Namespace to search in

***

### toolName?

> `optional` **toolName**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:75](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L75)

Custom name for the tool (defaults to `${storeName}_search`)
