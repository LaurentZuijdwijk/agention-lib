# Interface: PipelineStructure

Defined in: [lib/graph/GraphMetrics.ts:78](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L78)

Represents the structure of a pipeline for visualization.

## Properties

### children?

> `optional` **children**: `PipelineStructure`[]

Defined in: [lib/graph/GraphMetrics.ts:92](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L92)

Child nodes

***

### name

> **name**: `string`

Defined in: [lib/graph/GraphMetrics.ts:90](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L90)

Display name

***

### type

> **type**: `"map"` \| `"sequential"` \| `"parallel"` \| `"pipeline"` \| `"voting"` \| `"router"` \| `"agent"` \| `"custom"`

Defined in: [lib/graph/GraphMetrics.ts:80](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/graph/GraphMetrics.ts#L80)

Type of this node
