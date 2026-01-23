# Interface: SequentialExecutorOptions

Defined in: [lib/graph/SequentialExecutor.ts:11](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/SequentialExecutor.ts#L11)

Options for configuring sequential execution behavior.

## Properties

### wrapInput?

> `optional` **wrapInput**: `boolean`

Defined in: [lib/graph/SequentialExecutor.ts:17](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/SequentialExecutor.ts#L17)

If true, wraps the input in a JSON object with originalQuestion and resultFromPreviousAgent.
If false, passes the raw result from one agent to the next.

#### Default

```ts
true
```
