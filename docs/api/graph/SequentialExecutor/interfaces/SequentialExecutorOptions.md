# Interface: SequentialExecutorOptions

Defined in: [lib/graph/SequentialExecutor.ts:11](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/SequentialExecutor.ts#L11)

Options for configuring sequential execution behavior.

## Properties

### wrapInput?

> `optional` **wrapInput**: `boolean`

Defined in: [lib/graph/SequentialExecutor.ts:17](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/SequentialExecutor.ts#L17)

If true, wraps the input in a JSON object with originalQuestion and resultFromPreviousAgent.
If false, passes the raw result from one agent to the next.

#### Default

```ts
true
```
