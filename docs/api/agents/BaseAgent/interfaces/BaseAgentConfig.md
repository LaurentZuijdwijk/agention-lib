# ~~Interface: BaseAgentConfig~~

Agent config as used across all agents

## Deprecated

Use CommonAgentConfig with vendorConfig instead

## Extends

- [`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md)

## Properties

### ~~agents?~~

> `optional` **agents**: [`BaseAgent`](../classes/BaseAgent.md)\<`unknown`, `unknown`\>[]

Array of sub-agents this agent can delegate tasks to

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`agents`](../../AgentConfig/interfaces/CommonAgentConfig.md#agents)

***

### ~~apiKey~~

> **apiKey**: `string`

API key for authenticating with the LLM provider

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`apiKey`](../../AgentConfig/interfaces/CommonAgentConfig.md#apikey)

***

### ~~debug?~~

> `optional` **debug**: `boolean`

Enable debug logging for troubleshooting (default: false)

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`debug`](../../AgentConfig/interfaces/CommonAgentConfig.md#debug)

***

### ~~description~~

> **description**: `string`

Description of the agent's purpose and capabilities

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`description`](../../AgentConfig/interfaces/CommonAgentConfig.md#description)

***

### ~~frequencyPenalty?~~

> `optional` **frequencyPenalty**: `number`

Penalty based on token frequency in the text (-2.0 to 2.0)

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`frequencyPenalty`](../../AgentConfig/interfaces/CommonAgentConfig.md#frequencypenalty)

***

### ~~id~~

> **id**: `string`

Unique identifier for the agent instance

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`id`](../../AgentConfig/interfaces/CommonAgentConfig.md#id)

***

### ~~maxHistoryLength?~~

> `optional` **maxHistoryLength**: `number`

Maximum number of messages to retain in conversation history

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`maxHistoryLength`](../../AgentConfig/interfaces/CommonAgentConfig.md#maxhistorylength)

***

### ~~maxRetries?~~

> `optional` **maxRetries**: `number`

Maximum number of retry attempts on API failures

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`maxRetries`](../../AgentConfig/interfaces/CommonAgentConfig.md#maxretries)

***

### ~~maxTokens?~~

> `optional` **maxTokens**: `number`

Maximum number of tokens to generate in the response

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`maxTokens`](../../AgentConfig/interfaces/CommonAgentConfig.md#maxtokens)

***

### ~~model?~~

> `optional` **model**: `string`

Model identifier (e.g., "claude-3-5-sonnet-20241022", "gpt-4")

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`model`](../../AgentConfig/interfaces/CommonAgentConfig.md#model)

***

### ~~name~~

> **name**: `string`

Human-readable name for the agent

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`name`](../../AgentConfig/interfaces/CommonAgentConfig.md#name)

***

### ~~presencePenalty?~~

> `optional` **presencePenalty**: `number`

Penalty for using tokens that already appear in the text (-2.0 to 2.0)

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`presencePenalty`](../../AgentConfig/interfaces/CommonAgentConfig.md#presencepenalty)

***

### ~~seed?~~

> `optional` **seed**: `number`

Random seed for deterministic outputs (when supported by vendor)

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`seed`](../../AgentConfig/interfaces/CommonAgentConfig.md#seed)

***

### ~~stopSequences?~~

> `optional` **stopSequences**: `string`[]

Sequences that will stop generation when encountered

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`stopSequences`](../../AgentConfig/interfaces/CommonAgentConfig.md#stopsequences)

***

### ~~temperature?~~

> `optional` **temperature**: `number`

Sampling temperature (0.0-1.0). Higher values increase randomness

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`temperature`](../../AgentConfig/interfaces/CommonAgentConfig.md#temperature)

***

### ~~timeout?~~

> `optional` **timeout**: `number`

Request timeout in milliseconds

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`timeout`](../../AgentConfig/interfaces/CommonAgentConfig.md#timeout)

***

### ~~tools?~~

> `optional` **tools**: [`Tool`](../../../tools/Tool/classes/Tool.md)\<`unknown`\>[]

Array of tools the agent can use during execution

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`tools`](../../AgentConfig/interfaces/CommonAgentConfig.md#tools)

***

### ~~topK?~~

> `optional` **topK**: `number`

Top-K sampling. Only considers the K most likely tokens (Anthropic, Gemini)

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`topK`](../../AgentConfig/interfaces/CommonAgentConfig.md#topk)

***

### ~~topP?~~

> `optional` **topP**: `number`

Nucleus sampling threshold (0.0-1.0). Considers tokens with top cumulative probability

#### Inherited from

[`CommonAgentConfig`](../../AgentConfig/interfaces/CommonAgentConfig.md).[`topP`](../../AgentConfig/interfaces/CommonAgentConfig.md#topp)

***

### ~~vendor~~

> **vendor**: [`AgentVendor`](../../AgentConfig/type-aliases/AgentVendor.md)

***

### ~~vendorConfig?~~

> `optional` **vendorConfig**: [`VendorSpecificConfig`](../../AgentConfig/interfaces/VendorSpecificConfig.md)
