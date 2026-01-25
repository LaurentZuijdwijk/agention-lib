# Class: Agent

Defined in: [lib/agents/Agent.ts:41](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/agents/Agent.ts#L41)

## Constructors

### Constructor

> **new Agent**(): `Agent`

#### Returns

`Agent`

## Methods

### create()

> `static` **create**(`config`, `history?`): [`ClaudeAgent`](../../anthropic/ClaudeAgent/classes/ClaudeAgent.md) \| [`OpenAiAgent`](../../openai/OpenAiAgent/classes/OpenAiAgent.md) \| [`MistralAgent`](../../mistral/MistralAgent/classes/MistralAgent.md) \| [`GeminiAgent`](../../google/GeminiAgent/classes/GeminiAgent.md)

Defined in: [lib/agents/Agent.ts:42](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/agents/Agent.ts#L42)

#### Parameters

##### config

`AgentConfig`

##### history?

[`History`](../../../history/History/classes/History.md)

#### Returns

[`ClaudeAgent`](../../anthropic/ClaudeAgent/classes/ClaudeAgent.md) \| [`OpenAiAgent`](../../openai/OpenAiAgent/classes/OpenAiAgent.md) \| [`MistralAgent`](../../mistral/MistralAgent/classes/MistralAgent.md) \| [`GeminiAgent`](../../google/GeminiAgent/classes/GeminiAgent.md)
