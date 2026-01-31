# Interface: VizConfigOptions

Configuration management for visualization reporting.
Reads from environment variables and allows programmatic overrides.

## Properties

### enabled?

> `optional` **enabled**: `boolean`

Enable/disable visualization reporting

***

### maxQueueSize?

> `optional` **maxQueueSize**: `number`

Maximum events to queue when disconnected

***

### reconnect?

> `optional` **reconnect**: `boolean`

Auto-reconnect on disconnect

***

### reconnectInterval?

> `optional` **reconnectInterval**: `number`

Reconnect interval in milliseconds

***

### sessionName?

> `optional` **sessionName**: `string`

Session name for labeling

***

### url?

> `optional` **url**: `string`

WebSocket URL for the visualization server
