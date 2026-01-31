# Class: ToolEvent

## Extended by

- [`ToolResultEvent`](ToolResultEvent.md)

## Constructors

### Constructor

> **new ToolEvent**(`target`, `input`, `id`, `agentId`, `agentName`): `ToolEvent`

#### Parameters

##### target

[`Tool`](Tool.md)\<`any`\>

##### input

`Record`\<`string`, `any`\>

##### id

`string`

##### agentId

`string`

##### agentName

`string`

#### Returns

`ToolEvent`

## Properties

### agentId

> **agentId**: `string`

***

### agentName

> **agentName**: `string`

***

### id

> **id**: `string`

***

### input

> **input**: `Record`\<`string`, `any`\>

***

### target

> **target**: [`Tool`](Tool.md)\<`any`\>

***

### EXECUTE

> `static` **EXECUTE**: `string` = `"execute"`

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
