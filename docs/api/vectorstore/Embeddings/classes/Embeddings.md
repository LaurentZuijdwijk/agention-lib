# Abstract Class: Embeddings

Defined in: [lib/vectorstore/Embeddings.ts:37](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L37)

Abstract interface for embedding providers.

Implementations generate vector representations of text that can be
used for semantic similarity search in vector stores.

## Example

```typescript
class OpenAIEmbeddings extends Embeddings {
  async embed(texts: string[]): Promise<number[][]> {
    const response = await openai.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map(d => d.embedding);
  }
}
```

## Extended by

- [`OpenAIEmbeddings`](../../OpenAIEmbeddings/classes/OpenAIEmbeddings.md)

## Constructors

### Constructor

> **new Embeddings**(): `Embeddings`

#### Returns

`Embeddings`

## Properties

### dimensions

> `abstract` `readonly` **dimensions**: `number`

Defined in: [lib/vectorstore/Embeddings.ts:45](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L45)

Number of dimensions in the output vectors

***

### model

> `abstract` `readonly` **model**: `string`

Defined in: [lib/vectorstore/Embeddings.ts:42](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L42)

The model being used for embeddings

***

### name

> `abstract` `readonly` **name**: `string`

Defined in: [lib/vectorstore/Embeddings.ts:39](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L39)

Name identifier for this embeddings provider

## Methods

### embed()

> `abstract` **embed**(`texts`): `Promise`\<`number`[][]\>

Defined in: [lib/vectorstore/Embeddings.ts:53](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L53)

Generate embeddings for multiple texts.

#### Parameters

##### texts

`string`[]

Array of text strings to embed

#### Returns

`Promise`\<`number`[][]\>

Array of embedding vectors (one per input text)

***

### embedOne()

> **embedOne**(`text`): `Promise`\<`number`[]\>

Defined in: [lib/vectorstore/Embeddings.ts:62](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L62)

Generate embedding for a single text.
Default implementation calls embed() with a single-item array.

#### Parameters

##### text

`string`

Text string to embed

#### Returns

`Promise`\<`number`[]\>

Embedding vector

***

### embedQuery()

> **embedQuery**(`query`): `Promise`\<`number`[]\>

Defined in: [lib/vectorstore/Embeddings.ts:75](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L75)

Generate embedding for a search query.
Some providers use different models/settings for queries vs documents.
Default implementation calls embedOne().

#### Parameters

##### query

`string`

Query text to embed

#### Returns

`Promise`\<`number`[]\>

Embedding vector optimized for query
