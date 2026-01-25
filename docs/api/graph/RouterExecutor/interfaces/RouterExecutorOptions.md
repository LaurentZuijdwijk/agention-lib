# Interface: RouterExecutorOptions

Defined in: [lib/graph/RouterExecutor.ts:19](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L19)

Options for configuring the router executor.

## Properties

### fallbackRoute?

> `optional` **fallbackRoute**: `string`

Defined in: [lib/graph/RouterExecutor.ts:37](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L37)

Fallback route name to use if the router fails to select a valid route.
If not specified and router fails, an error is thrown.

***

### includeRouterContext?

> `optional` **includeRouterContext**: `boolean`

Defined in: [lib/graph/RouterExecutor.ts:31](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L31)

If true, includes the original input when executing the selected route.
If false, passes only the input to the route handler.

#### Default

```ts
true
```

***

### promptTemplate?

> `optional` **promptTemplate**: `string`

Defined in: [lib/graph/RouterExecutor.ts:24](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/RouterExecutor.ts#L24)

Custom prompt template for the router agent.
Use {input} for the user input and {routes} for the formatted route options.
