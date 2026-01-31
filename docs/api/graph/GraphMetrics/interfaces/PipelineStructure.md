# Interface: PipelineStructure

Represents the structure of a pipeline for visualization.

## Properties

### children?

> `optional` **children**: `PipelineStructure`[]

Child nodes

***

### name

> **name**: `string`

Display name

***

### type

> **type**: `"sequential"` \| `"parallel"` \| `"map"` \| `"voting"` \| `"router"` \| `"pipeline"` \| `"agent"` \| `"custom"`

Type of this node
