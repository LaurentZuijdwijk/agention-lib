# Interface: NodeExecutionMetrics

Metrics for a single node execution.

## Properties

### children?

> `optional` **children**: `NodeExecutionMetrics`[]

Child node metrics (for composite executors)

***

### durationMs

> **durationMs**: `number`

Duration in milliseconds

***

### endTime

> **endTime**: `number`

End timestamp

***

### error?

> `optional` **error**: `string`

Error message if failed

***

### id

> **id**: `string`

Unique identifier for this execution

***

### inputSummary?

> `optional` **inputSummary**: `string`

Input summary (truncated for large inputs)

***

### name

> **name**: `string`

Name of the node/agent

***

### order?

> `optional` **order**: `number`

Execution order within parent (for sequential/parallel)

***

### outputSummary?

> `optional` **outputSummary**: `string`

Output summary (truncated for large outputs)

***

### startTime

> **startTime**: `number`

Start timestamp

***

### success

> **success**: `boolean`

Whether execution succeeded

***

### tokenUsage?

> `optional` **tokenUsage**: [`MetricsTokenUsage`](MetricsTokenUsage.md)

Token usage if applicable

***

### type

> **type**: `"sequential"` \| `"parallel"` \| `"map"` \| `"voting"` \| `"router"` \| `"pipeline"` \| `"agent"` \| `"custom"`

Type of executor (sequential, parallel, pipeline, map, voting, router, agent)
