# Class: ToolResultEvent

Defined in: [lib/tools/Tool.ts:50](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L50)

## Extends

- [`ToolEvent`](ToolEvent.md)

## Constructors

### Constructor

> **new ToolResultEvent**(`target`, `input`, `id`, `result`, `agentId`, `agentName`): `ToolResultEvent`

Defined in: [lib/tools/Tool.ts:54](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L54)

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

Defined in: [lib/tools/Tool.ts:59](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L59)

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`agentId`](ToolEvent.md#agentid)

***

### agentName

> **agentName**: `string`

Defined in: [lib/tools/Tool.ts:60](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L60)

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`agentName`](ToolEvent.md#agentname)

***

### eventName

> **eventName**: `string` = `"ToolResult"`

Defined in: [lib/tools/Tool.ts:51](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L51)

***

### id

> **id**: `string`

Defined in: [lib/tools/Tool.ts:57](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L57)

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`id`](ToolEvent.md#id)

***

### input

> **input**: `Record`\<`string`, `any`\>

Defined in: [lib/tools/Tool.ts:56](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L56)

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`input`](ToolEvent.md#input)

***

### result

> **result**: `any`

Defined in: [lib/tools/Tool.ts:58](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L58)

***

### target

> **target**: [`Tool`](Tool.md)\<`any`\>

Defined in: [lib/tools/Tool.ts:55](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L55)

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`target`](ToolEvent.md#target)

***

### EXECUTE

> `static` **EXECUTE**: `string` = `"execute"`

Defined in: [lib/tools/Tool.ts:29](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L29)

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`EXECUTE`](ToolEvent.md#execute)

***

### RESULT

> `static` **RESULT**: `string` = `"toolResult"`

Defined in: [lib/tools/Tool.ts:52](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L52)

## Accessors

### isDefaultPrevented

#### Get Signature

> **get** **isDefaultPrevented**(): `boolean`

Defined in: [lib/tools/Tool.ts:45](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L45)

##### Returns

`boolean`

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`isDefaultPrevented`](ToolEvent.md#isdefaultprevented)

## Methods

### preventDefault()

> **preventDefault**(): `void`

Defined in: [lib/tools/Tool.ts:41](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/tools/Tool.ts#L41)

#### Returns

`void`

#### Inherited from

[`ToolEvent`](ToolEvent.md).[`preventDefault`](ToolEvent.md#preventdefault)
