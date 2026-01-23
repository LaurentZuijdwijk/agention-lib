# Class: MaxTokensExceededError

Defined in: [lib/agents/errors/AgentError.ts:42](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/errors/AgentError.ts#L42)

Error thrown when maximum token limit is exceeded

## Extends

- [`AgentError`](AgentError.md)

## Constructors

### Constructor

> **new MaxTokensExceededError**(`message`, `tokenLimit`): `MaxTokensExceededError`

Defined in: [lib/agents/errors/AgentError.ts:43](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/errors/AgentError.ts#L43)

#### Parameters

##### message

`string`

##### tokenLimit

`number`

#### Returns

`MaxTokensExceededError`

#### Overrides

[`AgentError`](AgentError.md).[`constructor`](AgentError.md#constructor)

## Properties

### message

> **message**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1068

#### Inherited from

[`AgentError`](AgentError.md).[`message`](AgentError.md#message)

***

### name

> **name**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1067

#### Inherited from

[`AgentError`](AgentError.md).[`name`](AgentError.md#name)

***

### stack?

> `optional` **stack**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1069

#### Inherited from

[`AgentError`](AgentError.md).[`stack`](AgentError.md#stack)

***

### tokenLimit

> **tokenLimit**: `number`

Defined in: [lib/agents/errors/AgentError.ts:43](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/errors/AgentError.ts#L43)

***

### prepareStackTrace()?

> `static` `optional` **prepareStackTrace**: (`err`, `stackTraces`) => `any`

Defined in: node\_modules/@types/node/globals.d.ts:98

Optional override for formatting stack traces

#### Parameters

##### err

`Error`

##### stackTraces

`CallSite`[]

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

[`AgentError`](AgentError.md).[`prepareStackTrace`](AgentError.md#preparestacktrace)

***

### stackTraceLimit

> `static` **stackTraceLimit**: `number`

Defined in: node\_modules/@types/node/globals.d.ts:100

#### Inherited from

[`AgentError`](AgentError.md).[`stackTraceLimit`](AgentError.md#stacktracelimit)

## Methods

### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Defined in: node\_modules/@types/node/globals.d.ts:91

Create .stack property on a target object

#### Parameters

##### targetObject

`object`

##### constructorOpt?

`Function`

#### Returns

`void`

#### Inherited from

[`AgentError`](AgentError.md).[`captureStackTrace`](AgentError.md#capturestacktrace)
