# Interface: MapExecutorOptions

Defined in: [lib/graph/MapExecutor.ts:6](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/MapExecutor.ts#L6)

Options for configuring map execution behavior.

## Properties

### concurrency?

> `optional` **concurrency**: `number`

Defined in: [lib/graph/MapExecutor.ts:12](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/MapExecutor.ts#L12)

Maximum number of concurrent executions.
If undefined, all items are processed in parallel.

#### Default

```ts
undefined (unlimited)
```
