# Interface: Route\<TInput, TOutput\>

Defined in: [lib/graph/RouterExecutor.ts:7](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/RouterExecutor.ts#L7)

Represents a route option that the router can select.

## Type Parameters

### TInput

`TInput` = `string`

### TOutput

`TOutput` = `string`

## Properties

### description

> **description**: `string`

Defined in: [lib/graph/RouterExecutor.ts:11](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/RouterExecutor.ts#L11)

Description of when this route should be selected

***

### handler

> **handler**: [`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)\<`unknown`, `unknown`\> \| [`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md)\<`TInput`, `TOutput`\>

Defined in: [lib/graph/RouterExecutor.ts:13](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/RouterExecutor.ts#L13)

The handler to execute when this route is selected

***

### name

> **name**: `string`

Defined in: [lib/graph/RouterExecutor.ts:9](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/RouterExecutor.ts#L9)

Unique identifier for this route
