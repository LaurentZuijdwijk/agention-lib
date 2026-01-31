# Class: AgentEvent

## Constructors

### Constructor

> **new AgentEvent**(`target`): `AgentEvent`

#### Parameters

##### target

[`BaseAgent`](../../BaseAgent/classes/BaseAgent.md)\<`any`\>

#### Returns

`AgentEvent`

## Properties

### target

> **target**: [`BaseAgent`](../../BaseAgent/classes/BaseAgent.md)\<`any`\>

***

### AFTER\_EXECUTE

> `static` **AFTER\_EXECUTE**: `string` = `"after_execute"`

***

### BEFORE\_EXECUTE

> `static` **BEFORE\_EXECUTE**: `string` = `"before_execute"`

***

### DONE

> `static` **DONE**: `string` = `"done"`

***

### ERROR

> `static` **ERROR**: `string` = `"error"`

***

### MAX\_RETRIES\_EXCEEDED

> `static` **MAX\_RETRIES\_EXCEEDED**: `string` = `"max_retries_exceeded"`

***

### MAX\_TOKENS\_EXCEEDED

> `static` **MAX\_TOKENS\_EXCEEDED**: `string` = `"max_tokens_exceeded"`

***

### RETRY

> `static` **RETRY**: `string` = `"retry"`

***

### TOOL\_ERROR

> `static` **TOOL\_ERROR**: `string` = `"tool_error"`

***

### TOOL\_USE

> `static` **TOOL\_USE**: `string` = `"toolUse"`

## Accessors

### isDefaultPrevented

#### Get Signature

> **get** **isDefaultPrevented**(): `boolean`

##### Returns

`boolean`

## Methods

### preventDefault()

> **preventDefault**(): `void`

#### Returns

`void`
