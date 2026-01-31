# Class: ToolResultEvent

## Extends

- [`ToolEvent`](ToolEvent.md)

## Constructors

### Constructor

> **new ToolResultEvent**(`target`, `input`, `id`, `result`, `agentId`, `agentName`): `ToolResultEvent`

#### Parameters

##### target

[`Tool`](Tool.md)\<`any`\>

##### input

`Record`\<`string`, `any`\>

##### id

`string`

##### result

`any`

##### agentId

`string`

##### agentName

`string`

#### Returns

`ToolResultEvent`

#### Overrides

[`ToolEvent`](ToolEvent.md).[`constructor`](ToolEvent.md#constructor)

## Properties

### agentId

> **agentId**: `string`

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`agentId`](ToolEvent.md#agentid)

***

### agentName

> **agentName**: `string`

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`agentName`](ToolEvent.md#agentname)

***

### eventName

> **eventName**: `string` = `"ToolResult"`

***

### id

> **id**: `string`

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`id`](ToolEvent.md#id)

***

### input

> **input**: `Record`\<`string`, `any`\>

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`input`](ToolEvent.md#input)

***

### result

> **result**: `any`

***

### target

> **target**: [`Tool`](Tool.md)\<`any`\>

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`target`](ToolEvent.md#target)

***

### EXECUTE

> `static` **EXECUTE**: `string` = `"execute"`

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`EXECUTE`](ToolEvent.md#execute)

***

### RESULT

> `static` **RESULT**: `string` = `"toolResult"`

## Accessors

### isDefaultPrevented

#### Get Signature

> **get** **isDefaultPrevented**(): `boolean`

##### Returns

`boolean`

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`isDefaultPrevented`](ToolEvent.md#isdefaultprevented)

## Methods

### preventDefault()

> **preventDefault**(): `void`

#### Returns

`void`

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`preventDefault`](ToolEvent.md#preventdefault)
