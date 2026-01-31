# Interface: SequentialExecutorOptions

Options for configuring sequential execution behavior.

## Properties

### wrapInput?

> `optional` **wrapInput**: `boolean`

If true, wraps the input in a JSON object with originalQuestion and resultFromPreviousAgent.
If false, passes the raw result from one agent to the next.

#### Default

```ts
true
```
