# Class: Agent

Defined in: [lib/agents/Agent.ts:8](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/Agent.ts#L8)

## Constructors

### Constructor

> **new Agent**(): `Agent`

#### Returns

`Agent`

## Methods

### create()

> `static` **create**(`config`, `history?`): [`ClaudeAgent`](../../anthropic/ClaudeAgent/classes/ClaudeAgent.md) \| [`OpenAiAgent`](../../openai/OpenAiAgent/classes/OpenAiAgent.md)

Defined in: [lib/agents/Agent.ts:9](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/agents/Agent.ts#L9)

#### Parameters

##### config

[`BaseAgentConfig`](../../BaseAgent/interfaces/BaseAgentConfig.md)

##### history?

[`History`](../../../history/History/classes/History.md)

#### Returns

[`ClaudeAgent`](../../anthropic/ClaudeAgent/classes/ClaudeAgent.md) \| [`OpenAiAgent`](../../openai/OpenAiAgent/classes/OpenAiAgent.md)
