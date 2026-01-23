# Class: MetricsCollector

Defined in: [lib/graph/GraphMetrics.ts:98](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L98)

Collector for gathering metrics during graph execution.

## Constructors

### Constructor

> **new MetricsCollector**(): `MetricsCollector`

#### Returns

`MetricsCollector`

## Methods

### addTokenUsage()

> **addTokenUsage**(`usage`): `void`

Defined in: [lib/graph/GraphMetrics.ts:209](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L209)

Add token usage to the current execution.

#### Parameters

##### usage

[`MetricsTokenUsage`](../interfaces/MetricsTokenUsage.md)

#### Returns

`void`

***

### endExecution()

> **endExecution**(`id`, `success`, `output?`, `tokenUsage?`, `error?`): `void`

Defined in: [lib/graph/GraphMetrics.ts:160](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L160)

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

Defined in: [lib/graph/GraphMetrics.ts:231](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L231)

Calculate aggregate metrics.

#### Returns

[`PipelineMetrics`](../interfaces/PipelineMetrics.md)

***

### getExecutions()

> **getExecutions**(): [`NodeExecutionMetrics`](../interfaces/NodeExecutionMetrics.md)[]

Defined in: [lib/graph/GraphMetrics.ts:224](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L224)

Get all collected metrics.

#### Returns

[`NodeExecutionMetrics`](../interfaces/NodeExecutionMetrics.md)[]

***

### reset()

> **reset**(): `void`

Defined in: [lib/graph/GraphMetrics.ts:312](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L312)

Reset all collected metrics.

#### Returns

`void`

***

### startExecution()

> **startExecution**(`name`, `type`, `input?`): `string`

Defined in: [lib/graph/GraphMetrics.ts:123](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L123)

Start tracking a node execution.

#### Parameters

##### name

`string`

##### type

`"map"` | `"sequential"` | `"parallel"` | `"pipeline"` | `"voting"` | `"router"` | `"agent"` | `"custom"`

##### input?

`unknown`

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `string`

Defined in: [lib/graph/GraphMetrics.ts:354](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L354)

Generate a JSON representation suitable for external visualization tools.

#### Returns

`string`

***

### toTextVisualization()

> **toTextVisualization**(): `string`

Defined in: [lib/graph/GraphMetrics.ts:322](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L322)

Generate a simple text-based visualization of the pipeline.

#### Returns

`string`
