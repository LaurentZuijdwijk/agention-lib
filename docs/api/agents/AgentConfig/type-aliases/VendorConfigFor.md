# Type Alias: VendorConfigFor\<V\>

> **VendorConfigFor**\<`V`\> = `V` *extends* `"anthropic"` ? [`ClaudeSpecificConfig`](../interfaces/ClaudeSpecificConfig.md) : `V` *extends* `"openai"` ? [`OpenAISpecificConfig`](../interfaces/OpenAISpecificConfig.md) : `V` *extends* `"mistral"` ? [`MistralSpecificConfig`](../interfaces/MistralSpecificConfig.md) : `V` *extends* `"gemini"` ? [`GeminiSpecificConfig`](../interfaces/GeminiSpecificConfig.md) : `never`

Helper type to extract vendor-specific config for a given vendor

## Type Parameters

### V

`V` *extends* [`AgentVendor`](AgentVendor.md)
