# Interface: AgentConfig

Complete agent configuration with vendor-specific extensions

## Example

```typescript
const config: AgentConfig = {
  id: "1",
  name: "Assistant",
  description: "A helpful assistant",
  apiKey: process.env.API_KEY,
  temperature: 0.7,
  vendorConfig: {
    openai: {
      disableReasoning: true,
      reasoningEffort: "high"
    }
  }
};
```

## Extends

- [`CommonAgentConfig`](CommonAgentConfig.md)

## Properties

### agents?

> `optional` **agents**: [`BaseAgent`](../../BaseAgent/classes/BaseAgent.md)\<`unknown`, `unknown`\>[]

Array of sub-agents this agent can delegate tasks to

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`agents`](CommonAgentConfig.md#agents)

***

### apiKey

> **apiKey**: `string`

API key for authenticating with the LLM provider

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`apiKey`](CommonAgentConfig.md#apikey)

***

### debug?

> `optional` **debug**: `boolean`

Enable debug logging for troubleshooting (default: false)

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`debug`](CommonAgentConfig.md#debug)

***

### description

> **description**: `string`

Description of the agent's purpose and capabilities

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`description`](CommonAgentConfig.md#description)

***

### frequencyPenalty?

> `optional` **frequencyPenalty**: `number`

Penalty based on token frequency in the text (-2.0 to 2.0)

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`frequencyPenalty`](CommonAgentConfig.md#frequencypenalty)

***

### id

> **id**: `string`

Unique identifier for the agent instance

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`id`](CommonAgentConfig.md#id)

***

### maxHistoryLength?

> `optional` **maxHistoryLength**: `number`

Maximum number of messages to retain in conversation history

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`maxHistoryLength`](CommonAgentConfig.md#maxhistorylength)

***

### maxRetries?

> `optional` **maxRetries**: `number`

Maximum number of retry attempts on API failures

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`maxRetries`](CommonAgentConfig.md#maxretries)

***

### maxTokens?

> `optional` **maxTokens**: `number`

Maximum number of tokens to generate in the response

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`maxTokens`](CommonAgentConfig.md#maxtokens)

***

### model?

> `optional` **model**: `string`

Model identifier (e.g., "claude-3-5-sonnet-20241022", "gpt-4")

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`model`](CommonAgentConfig.md#model)

***

### name

> **name**: `string`

Human-readable name for the agent

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`name`](CommonAgentConfig.md#name)

***

### presencePenalty?

> `optional` **presencePenalty**: `number`

Penalty for using tokens that already appear in the text (-2.0 to 2.0)

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`presencePenalty`](CommonAgentConfig.md#presencepenalty)

***

### seed?

> `optional` **seed**: `number`

Random seed for deterministic outputs (when supported by vendor)

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`seed`](CommonAgentConfig.md#seed)

***

### stopSequences?

> `optional` **stopSequences**: `string`[]

Sequences that will stop generation when encountered

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`stopSequences`](CommonAgentConfig.md#stopsequences)

***

### temperature?

> `optional` **temperature**: `number`

Sampling temperature (0.0-1.0). Higher values increase randomness

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`temperature`](CommonAgentConfig.md#temperature)

***

### timeout?

> `optional` **timeout**: `number`

Request timeout in milliseconds

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`timeout`](CommonAgentConfig.md#timeout)

***

### tools?

> `optional` **tools**: [`Tool`](../../../tools/Tool/classes/Tool.md)\<`unknown`\>[]

Array of tools the agent can use during execution

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`tools`](CommonAgentConfig.md#tools)

***

### topK?

> `optional` **topK**: `number`

Top-K sampling. Only considers the K most likely tokens (Anthropic, Gemini)

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`topK`](CommonAgentConfig.md#topk)

***

### topP?

> `optional` **topP**: `number`

Nucleus sampling threshold (0.0-1.0). Considers tokens with top cumulative probability

#### Inherited from

[`CommonAgentConfig`](CommonAgentConfig.md).[`topP`](CommonAgentConfig.md#topp)

***

### vendor

> **vendor**: [`AgentVendor`](../type-aliases/AgentVendor.md)

***

### vendorConfig?

> `optional` **vendorConfig**: [`VendorSpecificConfig`](VendorSpecificConfig.md)
