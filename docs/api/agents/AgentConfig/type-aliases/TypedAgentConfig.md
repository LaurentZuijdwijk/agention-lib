# Type Alias: TypedAgentConfig\<V\>

> **TypedAgentConfig**\<`V`\> = [`CommonAgentConfig`](../interfaces/CommonAgentConfig.md) & `object`

Type-safe agent configuration for specific vendors
Use this to get type hints for vendor-specific config

## Type Declaration

### vendor

> **vendor**: `V`

### vendorConfig?

> `optional` **vendorConfig**: `V` *extends* `"anthropic"` ? `object` : `V` *extends* `"openai"` ? `object` : `V` *extends* `"mistral"` ? `object` : `V` *extends* `"gemini"` ? `object` : `never`

## Type Parameters

### V

`V` *extends* [`AgentVendor`](AgentVendor.md)
