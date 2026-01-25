# Interface: PipelineStructure

Defined in: [lib/graph/GraphMetrics.ts:78](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L78)

Represents the structure of a pipeline for visualization.

## Properties

### children?

> `optional` **children**: `PipelineStructure`[]

Defined in: [lib/graph/GraphMetrics.ts:92](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L92)

Child nodes

***

### name

> **name**: `string`

Defined in: [lib/graph/GraphMetrics.ts:90](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L90)

Display name

***

### type

> **type**: `"sequential"` \| `"parallel"` \| `"map"` \| `"voting"` \| `"router"` \| `"pipeline"` \| `"agent"` \| `"custom"`

Defined in: [lib/graph/GraphMetrics.ts:80](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/graph/GraphMetrics.ts#L80)

Type of this node
