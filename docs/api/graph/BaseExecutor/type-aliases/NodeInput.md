# Type Alias: NodeInput\<T\>

> **NodeInput**\<`T`\> = `T` *extends* [`GraphNode`](../interfaces/GraphNode.md)\<infer I, `unknown`\> ? `I` : `never`

Defined in: [lib/graph/BaseExecutor.ts:127](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L127)

Helper type for extracting input type from a GraphNode

## Type Parameters

### T

`T`
