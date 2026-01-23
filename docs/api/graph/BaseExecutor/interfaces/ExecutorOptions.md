# Interface: ExecutorOptions

Defined in: [lib/graph/BaseExecutor.ts:35](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L35)

Options for executor execution with metrics tracking.

## Properties

### collectMetrics?

> `optional` **collectMetrics**: `boolean`

Defined in: [lib/graph/BaseExecutor.ts:39](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L39)

Whether to collect metrics (default: false)

***

### metrics?

> `optional` **metrics**: [`MetricsCollector`](../../GraphMetrics/classes/MetricsCollector.md)

Defined in: [lib/graph/BaseExecutor.ts:37](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/BaseExecutor.ts#L37)

Metrics collector for tracking execution data
