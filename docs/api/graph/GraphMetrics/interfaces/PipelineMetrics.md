# Interface: PipelineMetrics

Defined in: [lib/graph/GraphMetrics.ts:58](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L58)

Aggregate metrics for a complete pipeline execution.

## Properties

### failureCount

> **failureCount**: `number`

Defined in: [lib/graph/GraphMetrics.ts:68](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L68)

Number of failed executions

***

### nodeCount

> **nodeCount**: `number`

Defined in: [lib/graph/GraphMetrics.ts:64](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L64)

Number of nodes executed

***

### stages

> **stages**: [`NodeExecutionMetrics`](NodeExecutionMetrics.md)[]

Defined in: [lib/graph/GraphMetrics.ts:70](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L70)

Detailed metrics for each stage

***

### structure

> **structure**: [`PipelineStructure`](PipelineStructure.md)

Defined in: [lib/graph/GraphMetrics.ts:72](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L72)

Pipeline structure for visualization

***

### successCount

> **successCount**: `number`

Defined in: [lib/graph/GraphMetrics.ts:66](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L66)

Number of successful executions

***

### totalDurationMs

> **totalDurationMs**: `number`

Defined in: [lib/graph/GraphMetrics.ts:60](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L60)

Total execution time in milliseconds

***

### totalTokens

> **totalTokens**: [`MetricsTokenUsage`](MetricsTokenUsage.md)

Defined in: [lib/graph/GraphMetrics.ts:62](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L62)

Total tokens used across all nodes
