# Interface: PipelineMetrics

Aggregate metrics for a complete pipeline execution.

## Properties

### failureCount

> **failureCount**: `number`

Number of failed executions

***

### nodeCount

> **nodeCount**: `number`

Number of nodes executed

***

### stages

> **stages**: [`NodeExecutionMetrics`](NodeExecutionMetrics.md)[]

Detailed metrics for each stage

***

### structure

> **structure**: [`PipelineStructure`](PipelineStructure.md)

Pipeline structure for visualization

***

### successCount

> **successCount**: `number`

Number of successful executions

***

### totalDurationMs

> **totalDurationMs**: `number`

Total execution time in milliseconds

***

### totalTokens

> **totalTokens**: [`MetricsTokenUsage`](MetricsTokenUsage.md)

Total tokens used across all nodes
