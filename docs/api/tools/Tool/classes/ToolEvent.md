# Class: ToolEvent

Defined in: [lib/tools/Tool.ts:31](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L31)

## Extended by

- [`ToolResultEvent`](ToolResultEvent.md)

## Constructors

### Constructor

> **new ToolEvent**(`target`, `input`, `id`, `agentId`, `agentName`): `ToolEvent`

Defined in: [lib/tools/Tool.ts:36](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L36)

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

Defined in: [lib/tools/Tool.ts:40](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L40)

***

### agentName

> **agentName**: `string`

Defined in: [lib/tools/Tool.ts:41](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L41)

***

### id

> **id**: `string`

Defined in: [lib/tools/Tool.ts:39](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L39)

***

### input

> **input**: `Record`\<`string`, `any`\>

Defined in: [lib/tools/Tool.ts:38](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L38)

***

### target

> **target**: [`Tool`](Tool.md)\<`any`\>

Defined in: [lib/tools/Tool.ts:37](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L37)

***

### EXECUTE

> `static` **EXECUTE**: `string` = `"execute"`

Defined in: [lib/tools/Tool.ts:32](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L32)

## Accessors

### isDefaultPrevented

#### Get Signature

> **get** **isDefaultPrevented**(): `boolean`

Defined in: [lib/tools/Tool.ts:48](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L48)

##### Returns

`boolean`

## Methods

### preventDefault()

> **preventDefault**(): `void`

Defined in: [lib/tools/Tool.ts:44](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/tools/Tool.ts#L44)

#### Returns

`void`
