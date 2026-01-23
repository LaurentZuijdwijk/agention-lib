# Type Alias: NodeInput\<T\>

> **NodeInput**\<`T`\> = `T` *extends* [`GraphNode`](../interfaces/GraphNode.md)\<infer I, `unknown`\> ? `I` : `never`

Defined in: [lib/graph/BaseExecutor.ts:127](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L127)

Helper type for extracting input type from a GraphNode

## Type Parameters

### T

`T`
