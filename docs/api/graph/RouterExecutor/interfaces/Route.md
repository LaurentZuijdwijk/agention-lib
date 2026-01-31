# Interface: Route\<TInput, TOutput\>

Represents a route option that the router can select.

## Type Parameters

### TInput

`TInput` = `string`

### TOutput

`TOutput` = `string`

## Properties

### description

> **description**: `string`

Description of when this route should be selected

***

### handler

> **handler**: [`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)\<`unknown`, `unknown`\> \| [`GraphNode`](../../BaseExecutor/interfaces/GraphNode.md)\<`TInput`, `TOutput`\>

The handler to execute when this route is selected

***

### name

> **name**: `string`

Unique identifier for this route
