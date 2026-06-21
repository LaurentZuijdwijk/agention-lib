import { History } from "../../history/History";
import {
  OpenAICompatibleAgent,
  OpenAICompatibleConfig,
} from "../openai-compatible/OpenAICompatibleAgent";
import { LlamaCppModel } from "../model-types";

type LlamaCppConfig = Omit<OpenAICompatibleConfig, "baseURL" | "model" | "vendor"> & {
  /** Base URL of the llama.cpp server's OpenAI-compatible API (default: `http://localhost:8080/v1`) */
  baseURL?: string;
  model?: LlamaCppModel;
};

/**
 * Agent for locally-hosted models served by a llama.cpp server (`llama-server`),
 * which exposes an OpenAI-compatible `/v1/chat/completions` API.
 *
 * Requires the `openai` package as a peer dependency and a running llama.cpp server.
 *
 * @example
 * ```typescript
 * const agent = new LlamaCppAgent({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   baseURL: "http://localhost:8080/v1",
 * });
 *
 * const response = await agent.execute("Hello!");
 * ```
 *
 * @example List available models
 * ```typescript
 * const models = await agent.listModels();
 * ```
 */
export class LlamaCppAgent extends OpenAICompatibleAgent {
  constructor(config: LlamaCppConfig, history?: History) {
    const vendorConfig = config.vendorConfig?.llamacpp || {};
    const baseURL =
      config.baseURL ?? vendorConfig.baseURL ?? "http://localhost:8080/v1";

    super(
      {
        ...config,
        vendor: "llamacpp",
        baseURL,
        model: config.model ?? "default",
      },
      history
    );
  }

  protected getVendorName(): string {
    return "llama.cpp";
  }
}
