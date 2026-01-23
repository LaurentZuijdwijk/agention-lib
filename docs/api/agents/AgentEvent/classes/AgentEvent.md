# Class: AgentEvent

Defined in: [lib/agents/AgentEvent.ts:3](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L3)

## Constructors

### Constructor

> **new AgentEvent**(`target`): `AgentEvent`

Defined in: [lib/agents/AgentEvent.ts:16](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L16)

#### Parameters

##### target

[`BaseAgent`](../../BaseAgent/classes/BaseAgent.md)\<`any`\>

#### Returns

`AgentEvent`

## Properties

### target

> **target**: [`BaseAgent`](../../BaseAgent/classes/BaseAgent.md)\<`any`\>

Defined in: [lib/agents/AgentEvent.ts:16](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L16)

***

### AFTER\_EXECUTE

> `static` **AFTER\_EXECUTE**: `string` = `"after_execute"`

Defined in: [lib/agents/AgentEvent.ts:5](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L5)

***

### BEFORE\_EXECUTE

> `static` **BEFORE\_EXECUTE**: `string` = `"before_execute"`

Defined in: [lib/agents/AgentEvent.ts:4](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L4)

***

### DONE

> `static` **DONE**: `string` = `"done"`

Defined in: [lib/agents/AgentEvent.ts:6](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L6)

***

### ERROR

> `static` **ERROR**: `string` = `"error"`

Defined in: [lib/agents/AgentEvent.ts:8](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L8)

***

### MAX\_RETRIES\_EXCEEDED

> `static` **MAX\_RETRIES\_EXCEEDED**: `string` = `"max_retries_exceeded"`

Defined in: [lib/agents/AgentEvent.ts:10](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L10)

***

### MAX\_TOKENS\_EXCEEDED

> `static` **MAX\_TOKENS\_EXCEEDED**: `string` = `"max_tokens_exceeded"`

Defined in: [lib/agents/AgentEvent.ts:11](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L11)

***

### RETRY

> `static` **RETRY**: `string` = `"retry"`

Defined in: [lib/agents/AgentEvent.ts:9](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L9)

***

### TOOL\_ERROR

> `static` **TOOL\_ERROR**: `string` = `"tool_error"`

Defined in: [lib/agents/AgentEvent.ts:12](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L12)

***

### TOOL\_USE

> `static` **TOOL\_USE**: `string` = `"toolUse"`

Defined in: [lib/agents/AgentEvent.ts:7](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L7)

## Accessors

### isDefaultPrevented

#### Get Signature

> **get** **isDefaultPrevented**(): `boolean`

Defined in: [lib/agents/AgentEvent.ts:22](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L22)

##### Returns

`boolean`

## Methods

### preventDefault()

> **preventDefault**(): `void`

Defined in: [lib/agents/AgentEvent.ts:18](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/AgentEvent.ts#L18)

#### Returns

`void`
