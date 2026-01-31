# Interface: VoyageAIEmbeddingsConfig

Configuration for VoyageAI embeddings.

## Properties

### apiKey?

> `optional` **apiKey**: `string`

VoyageAI API key (defaults to VOYAGE_API_KEY env var)

***

### baseURL?

> `optional` **baseURL**: `string`

Base URL for API (for proxies or compatible APIs)

***

### inputType?

> `optional` **inputType**: `"query"` \| `"document"`

Input type for optimization (default: "document")

***

### maxRetries?

> `optional` **maxRetries**: `number`

Maximum number of retries (default: 2)

***

### model?

> `optional` **model**: `string`

Model to use for embeddings

***

### timeoutInSeconds?

> `optional` **timeoutInSeconds**: `number`

Timeout in seconds (default: 60)

***

### truncation?

> `optional` **truncation**: `boolean`

Optional truncation mode
