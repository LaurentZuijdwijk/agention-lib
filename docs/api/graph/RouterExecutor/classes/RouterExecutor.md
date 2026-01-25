# Class: RouterExecutor

Defined in: [lib/graph/RouterExecutor.ts:69](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L69)

Routes input to one of several available handlers based on an agent's decision.
The router agent analyzes the input and selects the most appropriate route.

## Example

```typescript
const router = new RouterExecutor(routerAgent, [
  { name: "technical", description: "Technical questions about code", handler: techAgent },
  { name: "general", description: "General knowledge questions", handler: generalAgent },
  { name: "creative", description: "Creative writing tasks", handler: creativeAgent },
]);

const result = await router.execute("How do I fix this TypeScript error?");
// Router selects "technical" route and executes techAgent
```

## Extends

- [`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md)\<`string`, `string`\>

## Constructors

### Constructor

> **new RouterExecutor**(`router`, `routes`, `options`): `RouterExecutor`

Defined in: [lib/graph/RouterExecutor.ts:75](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L75)

#### Parameters

##### router

[`BaseAgent`](../../../agents/BaseAgent/classes/BaseAgent.md)

##### routes

[`Route`](../interfaces/Route.md)\<`string`, `string`\>[]

##### options

[`RouterExecutorOptions`](../interfaces/RouterExecutorOptions.md) = `{}`

#### Returns

`RouterExecutor`

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`constructor`](../../BaseExecutor/classes/BaseExecutor.md#constructor)

## Properties

### name

> **name**: `string`

Defined in: [lib/graph/BaseExecutor.ts:50](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L50)

Display name for this executor

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`name`](../../BaseExecutor/classes/BaseExecutor.md#name)

***

### nodeType

> **nodeType**: [`GraphNodeType`](../../BaseExecutor/type-aliases/GraphNodeType.md) = `"custom"`

Defined in: [lib/graph/BaseExecutor.ts:53](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L53)

Type of this node for metrics and visualization

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`nodeType`](../../BaseExecutor/classes/BaseExecutor.md#nodetype)

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Defined in: [lib/graph/RouterExecutor.ts:326](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L326)

Returns the number of available routes.

##### Returns

`number`

## Methods

### execute()

> **execute**(`input`): `Promise`\<`string`\>

Defined in: [lib/graph/RouterExecutor.ts:105](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L105)

Routes the input to the appropriate handler based on the router agent's decision.

#### Parameters

##### input

`string`

The input string to route

#### Returns

`Promise`\<`string`\>

The output from the selected route's handler

#### Overrides

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`execute`](../../BaseExecutor/classes/BaseExecutor.md#execute)

***

### getMetrics()

> **getMetrics**(): [`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

Defined in: [lib/graph/BaseExecutor.ts:92](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L92)

Get collected metrics (if metrics collection is enabled).

#### Returns

[`NodeExecutionMetrics`](../../GraphMetrics/interfaces/NodeExecutionMetrics.md)[] \| `undefined`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`getMetrics`](../../BaseExecutor/classes/BaseExecutor.md#getmetrics)

***

### getMetricsCollector()

> **getMetricsCollector**(): [`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

Defined in: [lib/graph/BaseExecutor.ts:99](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L99)

Get the metrics collector instance.

#### Returns

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md) \| `undefined`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`getMetricsCollector`](../../BaseExecutor/classes/BaseExecutor.md#getmetricscollector)

***

### getRouteNames()

> **getRouteNames**(): `string`[]

Defined in: [lib/graph/RouterExecutor.ts:319](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L319)

Returns the available route names.

#### Returns

`string`[]

***

### withMetrics()

> **withMetrics**(`collector?`): `this`

Defined in: [lib/graph/BaseExecutor.ts:64](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L64)

Enable metrics collection for this executor.

#### Parameters

##### collector?

[`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md)

#### Returns

`this`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`withMetrics`](../../BaseExecutor/classes/BaseExecutor.md#withmetrics)

***

### withName()

> **withName**(`name`): `this`

Defined in: [lib/graph/BaseExecutor.ts:73](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L73)

Set a custom name for this executor (used in metrics).

#### Parameters

##### name

`string`

#### Returns

`this`

#### Inherited from

[`BaseExecutor`](../../BaseExecutor/classes/BaseExecutor.md).[`withName`](../../BaseExecutor/classes/BaseExecutor.md#withname)
