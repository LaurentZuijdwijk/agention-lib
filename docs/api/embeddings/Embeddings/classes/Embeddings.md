# Abstract Class: Embeddings

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
- [`VoyageAIEmbeddings`](../../VoyageAIEmbeddings/classes/VoyageAIEmbeddings.md)

## Constructors

### Constructor

> **new Embeddings**(): `Embeddings`

#### Returns

`Embeddings`

## Properties

### dimensions

> `abstract` `readonly` **dimensions**: `number`

Number of dimensions in the output vectors

***

### model

> `abstract` `readonly` **model**: `string`

The model being used for embeddings

***

### name

> `abstract` `readonly` **name**: `string`

Name identifier for this embeddings provider

## Methods

### embed()

> `abstract` **embed**(`texts`): `Promise`\<`number`[][]\>

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
