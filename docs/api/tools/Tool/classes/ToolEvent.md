# Class: ToolEvent

Defined in: [lib/tools/Tool.ts:28](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L28)

## Extended by

- [`ToolResultEvent`](ToolResultEvent.md)

## Constructors

### Constructor

> **new ToolEvent**(`target`, `input`, `id`, `agentId`, `agentName`): `ToolEvent`

Defined in: [lib/tools/Tool.ts:33](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L33)

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

Defined in: [lib/tools/Tool.ts:37](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L37)

***

### agentName

> **agentName**: `string`

Defined in: [lib/tools/Tool.ts:38](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L38)

***

### id

> **id**: `string`

Defined in: [lib/tools/Tool.ts:36](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L36)

***

### input

> **input**: `Record`\<`string`, `any`\>

Defined in: [lib/tools/Tool.ts:35](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L35)

***

### target

> **target**: [`Tool`](Tool.md)\<`any`\>

Defined in: [lib/tools/Tool.ts:34](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L34)

***

### EXECUTE

> `static` **EXECUTE**: `string` = `"execute"`

Defined in: [lib/tools/Tool.ts:29](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L29)

## Accessors

### isDefaultPrevented

#### Get Signature

> **get** **isDefaultPrevented**(): `boolean`

Defined in: [lib/tools/Tool.ts:45](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L45)

##### Returns

`boolean`

## Methods

### preventDefault()

> **preventDefault**(): `void`

Defined in: [lib/tools/Tool.ts:41](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L41)

#### Returns

`void`
