# Class: ApiError

Defined in: [lib/agents/errors/AgentError.ts:28](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/agents/errors/AgentError.ts#L28)

Error thrown when LLM API request fails

## Extends

- [`AgentError`](AgentError.md)

## Constructors

### Constructor

> **new ApiError**(`message`, `statusCode?`, `response?`): `ApiError`

Defined in: [lib/agents/errors/AgentError.ts:29](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/agents/errors/AgentError.ts#L29)

#### Parameters

##### message

`string`

##### statusCode?

`number`

##### response?

`any`

#### Returns

`ApiError`

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

### response?

> `optional` **response**: `any`

Defined in: [lib/agents/errors/AgentError.ts:32](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/agents/errors/AgentError.ts#L32)

***

### stack?

> `optional` **stack**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1069

#### Inherited from

[`AgentError`](AgentError.md).[`stack`](AgentError.md#stack)

***

### statusCode?

> `optional` **statusCode**: `number`

Defined in: [lib/agents/errors/AgentError.ts:31](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/agents/errors/AgentError.ts#L31)

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
