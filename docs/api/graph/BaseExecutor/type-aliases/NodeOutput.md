# Type Alias: NodeOutput\<T\>

> **NodeOutput**\<`T`\> = `T` *extends* [`GraphNode`](../interfaces/GraphNode.md)\<`unknown`, infer O\> ? `O` : `never`

Defined in: [lib/graph/BaseExecutor.ts:132](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L132)

Helper type for extracting output type from a GraphNode

## Type Parameters

### T

`T`
