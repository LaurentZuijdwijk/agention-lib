# Type Alias: NodeOutput\<T\>

> **NodeOutput**\<`T`\> = `T` *extends* [`GraphNode`](../interfaces/GraphNode.md)\<`unknown`, infer O\> ? `O` : `never`

Defined in: [lib/graph/BaseExecutor.ts:132](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L132)

Helper type for extracting output type from a GraphNode

## Type Parameters

### T

`T`
