# Interface: PipelineContext

Defined in: [lib/graph/BaseExecutor.ts:109](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L109)

Configuration for passing context through pipeline stages.

## Properties

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [lib/graph/BaseExecutor.ts:113](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L113)

Metadata that can be passed between stages

***

### originalInput?

> `optional` **originalInput**: `unknown`

Defined in: [lib/graph/BaseExecutor.ts:111](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L111)

The original input that started the pipeline
