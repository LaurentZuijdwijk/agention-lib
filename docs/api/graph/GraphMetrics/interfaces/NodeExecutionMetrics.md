# Interface: NodeExecutionMetrics

Defined in: [lib/graph/GraphMetrics.ts:18](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L18)

Metrics for a single node execution.

## Properties

### children?

> `optional` **children**: `NodeExecutionMetrics`[]

Defined in: [lib/graph/GraphMetrics.ts:50](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L50)

Child node metrics (for composite executors)

***

### durationMs

> **durationMs**: `number`

Defined in: [lib/graph/GraphMetrics.ts:38](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L38)

Duration in milliseconds

***

### endTime

> **endTime**: `number`

Defined in: [lib/graph/GraphMetrics.ts:36](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L36)

End timestamp

***

### error?

> `optional` **error**: `string`

Defined in: [lib/graph/GraphMetrics.ts:44](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L44)

Error message if failed

***

### id

> **id**: `string`

Defined in: [lib/graph/GraphMetrics.ts:20](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L20)

Unique identifier for this execution

***

### inputSummary?

> `optional` **inputSummary**: `string`

Defined in: [lib/graph/GraphMetrics.ts:46](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L46)

Input summary (truncated for large inputs)

***

### name

> **name**: `string`

Defined in: [lib/graph/GraphMetrics.ts:22](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L22)

Name of the node/agent

***

### order?

> `optional` **order**: `number`

Defined in: [lib/graph/GraphMetrics.ts:52](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L52)

Execution order within parent (for sequential/parallel)

***

### outputSummary?

> `optional` **outputSummary**: `string`

Defined in: [lib/graph/GraphMetrics.ts:48](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L48)

Output summary (truncated for large outputs)

***

### startTime

> **startTime**: `number`

Defined in: [lib/graph/GraphMetrics.ts:34](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L34)

Start timestamp

***

### success

> **success**: `boolean`

Defined in: [lib/graph/GraphMetrics.ts:42](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L42)

Whether execution succeeded

***

### tokenUsage?

> `optional` **tokenUsage**: [`MetricsTokenUsage`](MetricsTokenUsage.md)

Defined in: [lib/graph/GraphMetrics.ts:40](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L40)

Token usage if applicable

***

### type

> **type**: `"sequential"` \| `"parallel"` \| `"map"` \| `"voting"` \| `"router"` \| `"pipeline"` \| `"agent"` \| `"custom"`

Defined in: [lib/graph/GraphMetrics.ts:24](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L24)

Type of executor (sequential, parallel, pipeline, map, voting, router, agent)
