# Interface: VizConfigOptions

Defined in: [lib/viz/VizConfig.ts:6](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/viz/VizConfig.ts#L6)

Configuration management for visualization reporting.
Reads from environment variables and allows programmatic overrides.

## Properties

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [lib/viz/VizConfig.ts:8](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/viz/VizConfig.ts#L8)

Enable/disable visualization reporting

***

### maxQueueSize?

> `optional` **maxQueueSize**: `number`

Defined in: [lib/viz/VizConfig.ts:18](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/viz/VizConfig.ts#L18)

Maximum events to queue when disconnected

***

### reconnect?

> `optional` **reconnect**: `boolean`

Defined in: [lib/viz/VizConfig.ts:14](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/viz/VizConfig.ts#L14)

Auto-reconnect on disconnect

***

### reconnectInterval?

> `optional` **reconnectInterval**: `number`

Defined in: [lib/viz/VizConfig.ts:16](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/viz/VizConfig.ts#L16)

Reconnect interval in milliseconds

***

### sessionName?

> `optional` **sessionName**: `string`

Defined in: [lib/viz/VizConfig.ts:12](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/viz/VizConfig.ts#L12)

Session name for labeling

***

### url?

> `optional` **url**: `string`

Defined in: [lib/viz/VizConfig.ts:10](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/viz/VizConfig.ts#L10)

WebSocket URL for the visualization server
