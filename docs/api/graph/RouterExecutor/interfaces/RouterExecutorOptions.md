# Interface: RouterExecutorOptions

Options for configuring the router executor.

## Properties

### fallbackRoute?

> `optional` **fallbackRoute**: `string`

Fallback route name to use if the router fails to select a valid route.
If not specified and router fails, an error is thrown.

***

### includeRouterContext?

> `optional` **includeRouterContext**: `boolean`

If true, includes the original input when executing the selected route.
If false, passes only the input to the route handler.

#### Default

```ts
true
```

***

### promptTemplate?

> `optional` **promptTemplate**: `string`

Custom prompt template for the router agent.
Use {input} for the user input and {routes} for the formatted route options.
