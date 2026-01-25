# Interface: MapExecutorOptions

Defined in: [lib/graph/MapExecutor.ts:6](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/MapExecutor.ts#L6)

Options for configuring map execution behavior.

## Properties

### concurrency?

> `optional` **concurrency**: `number`

Defined in: [lib/graph/MapExecutor.ts:12](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/MapExecutor.ts#L12)

Maximum number of concurrent executions.
If undefined, all items are processed in parallel.

#### Default

```ts
undefined (unlimited)
```
