# Interface: ParallelExecutorOptions

Defined in: [lib/graph/ParallelExecutor.ts:7](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/ParallelExecutor.ts#L7)

Options for configuring parallel execution behavior.

## Properties

### isolatedExecution?

> `optional` **isolatedExecution**: `boolean`

Defined in: [lib/graph/ParallelExecutor.ts:13](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/ParallelExecutor.ts#L13)

If true, each agent receives only the original input.
If false, agents receive the input with shared context.

#### Default

```ts
true
```

***

### wrapInput?

> `optional` **wrapInput**: `boolean`

Defined in: [lib/graph/ParallelExecutor.ts:20](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/ParallelExecutor.ts#L20)

If true, wraps the input in a JSON object with originalQuestion.
If false, passes the raw input to each agent.

#### Default

```ts
true
```
