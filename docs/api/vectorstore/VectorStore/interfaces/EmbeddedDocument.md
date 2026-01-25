# Interface: EmbeddedDocument

Defined in: [lib/vectorstore/VectorStore.ts:25](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L25)

A document with its computed embedding vector.

## Extends

- [`Document`](Document.md)

## Properties

### content

> **content**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:17](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L17)

The text content of the document

#### Inherited from

[`Document`](Document.md).[`content`](Document.md#content)

***

### embedding

> **embedding**: `number`[]

Defined in: [lib/vectorstore/VectorStore.ts:27](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L27)

The embedding vector for the document

***

### id

> **id**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:15](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L15)

Unique identifier for the document

#### Inherited from

[`Document`](Document.md).[`id`](Document.md#id)

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [lib/vectorstore/VectorStore.ts:19](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L19)

Optional metadata associated with the document

#### Inherited from

[`Document`](Document.md).[`metadata`](Document.md#metadata)
