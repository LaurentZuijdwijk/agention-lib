# Interface: CommonAgentConfig

Common configuration shared by all agents

## Extended by

- [`AgentConfig`](AgentConfig.md)
- [`BaseAgentConfig`](../../BaseAgent/interfaces/BaseAgentConfig.md)

## Properties

### agents?

> `optional` **agents**: [`BaseAgent`](../../BaseAgent/classes/BaseAgent.md)\<`unknown`, `unknown`\>[]

Array of sub-agents this agent can delegate tasks to

***

### apiKey

> **apiKey**: `string`

API key for authenticating with the LLM provider

***

### debug?

> `optional` **debug**: `boolean`

Enable debug logging for troubleshooting (default: false)

***

### description

> **description**: `string`

Description of the agent's purpose and capabilities

***

### frequencyPenalty?

> `optional` **frequencyPenalty**: `number`

Penalty based on token frequency in the text (-2.0 to 2.0)

***

### id

> **id**: `string`

Unique identifier for the agent instance

***

### maxHistoryLength?

> `optional` **maxHistoryLength**: `number`

Maximum number of messages to retain in conversation history

***

### maxRetries?

> `optional` **maxRetries**: `number`

Maximum number of retry attempts on API failures

***

### maxTokens?

> `optional` **maxTokens**: `number`

Maximum number of tokens to generate in the response

***

### model?

> `optional` **model**: `string`

Model identifier (e.g., "claude-3-5-sonnet-20241022", "gpt-4")

***

### name

> **name**: `string`

Human-readable name for the agent

***

### presencePenalty?

> `optional` **presencePenalty**: `number`

Penalty for using tokens that already appear in the text (-2.0 to 2.0)

***

### seed?

> `optional` **seed**: `number`

Random seed for deterministic outputs (when supported by vendor)

***

### stopSequences?

> `optional` **stopSequences**: `string`[]

Sequences that will stop generation when encountered

***

### temperature?

> `optional` **temperature**: `number`

Sampling temperature (0.0-1.0). Higher values increase randomness

***

### timeout?

> `optional` **timeout**: `number`

Request timeout in milliseconds

***

### tools?

> `optional` **tools**: [`Tool`](../../../tools/Tool/classes/Tool.md)\<`unknown`\>[]

Array of tools the agent can use during execution

***

### topK?

> `optional` **topK**: `number`

Top-K sampling. Only considers the K most likely tokens (Anthropic, Gemini)

***

### topP?

> `optional` **topP**: `number`

Nucleus sampling threshold (0.0-1.0). Considers tokens with top cumulative probability
