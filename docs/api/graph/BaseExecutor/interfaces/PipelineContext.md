# Interface: PipelineContext

Defined in: [lib/graph/BaseExecutor.ts:109](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L109)

Configuration for passing context through pipeline stages.

## Properties

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [lib/graph/BaseExecutor.ts:113](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L113)

Metadata that can be passed between stages

***

### originalInput?

> `optional` **originalInput**: `unknown`

Defined in: [lib/graph/BaseExecutor.ts:111](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/BaseExecutor.ts#L111)

The original input that started the pipeline
