# Interface: ParallelExecutorOptions

Options for configuring parallel execution behavior.

## Properties

### isolatedExecution?

> `optional` **isolatedExecution**: `boolean`

If true, each agent receives only the original input.
If false, agents receive the input with shared context.

#### Default

```ts
true
```

***

### wrapInput?

> `optional` **wrapInput**: `boolean`

If true, wraps the input in a JSON object with originalQuestion.
If false, passes the raw input to each agent.

#### Default

```ts
true
```
