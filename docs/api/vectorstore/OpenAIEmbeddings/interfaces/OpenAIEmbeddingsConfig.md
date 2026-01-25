# Interface: OpenAIEmbeddingsConfig

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:12](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L12)

Configuration for OpenAI embeddings.

## Properties

### apiKey?

> `optional` **apiKey**: `string`

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:14](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L14)

OpenAI API key (defaults to OPENAI_API_KEY env var)

***

### baseURL?

> `optional` **baseURL**: `string`

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:20](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L20)

Base URL for API (for proxies or compatible APIs)

***

### dimensions?

> `optional` **dimensions**: `number`

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:18](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L18)

Number of dimensions (only for text-embedding-3-* models)

***

### model?

> `optional` **model**: `string`

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:16](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L16)

Model to use for embeddings
