# Interface: SearchResult

Defined in: [lib/vectorstore/VectorStore.ts:33](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L33)

Result from a similarity search operation.

## Properties

### document

> **document**: [`Document`](Document.md)

Defined in: [lib/vectorstore/VectorStore.ts:35](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L35)

The matching document

***

### score

> **score**: `number`

Defined in: [lib/vectorstore/VectorStore.ts:37](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L37)

Similarity score (higher is more similar, typically 0-1)
