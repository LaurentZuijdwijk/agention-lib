# Class: MetricsCollector

Collector for gathering metrics during graph execution.

## Constructors

### Constructor

> **new MetricsCollector**(): `MetricsCollector`

#### Returns

`MetricsCollector`

## Methods

### addTokenUsage()

> **addTokenUsage**(`usage`): `void`

Add token usage to the current execution.

#### Parameters

##### usage

[`MetricsTokenUsage`](../interfaces/MetricsTokenUsage.md)

#### Returns

`void`

***

### endExecution()

> **endExecution**(`id`, `success`, `output?`, `tokenUsage?`, `error?`): `void`

Complete a node execution.

#### Parameters

##### id

`string`

##### success

`boolean`

##### output?

`unknown`

##### tokenUsage?

[`MetricsTokenUsage`](../interfaces/MetricsTokenUsage.md)

##### error?

`string`

#### Returns

`void`

***

### getAggregateMetrics()

> **getAggregateMetrics**(): [`PipelineMetrics`](../interfaces/PipelineMetrics.md)

Calculate aggregate metrics.

#### Returns

[`PipelineMetrics`](../interfaces/PipelineMetrics.md)

***

### getExecutions()

> **getExecutions**(): [`NodeExecutionMetrics`](../interfaces/NodeExecutionMetrics.md)[]

Get all collected metrics.

#### Returns

[`NodeExecutionMetrics`](../interfaces/NodeExecutionMetrics.md)[]

***

### reset()

> **reset**(): `void`

Reset all collected metrics.

#### Returns

`void`

***

### startExecution()

> **startExecution**(`name`, `type`, `input?`): `string`

Start tracking a node execution.

#### Parameters

##### name

`string`

##### type

`"sequential"` | `"parallel"` | `"map"` | `"voting"` | `"router"` | `"pipeline"` | `"agent"` | `"custom"`

##### input?

`unknown`

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `string`

Generate a JSON representation suitable for external visualization tools.

#### Returns

`string`

***

### toTextVisualization()

> **toTextVisualization**(): `string`

Generate a simple text-based visualization of the pipeline.

#### Returns

`string`
