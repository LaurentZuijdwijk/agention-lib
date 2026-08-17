import { Model } from "openai/resources/models";
import { History } from "../../history/History";
import { ModelInfo } from "../BaseAgent";
import {
  OpenAICompatibleAgent,
  OpenAICompatibleConfig,
} from "../openai-compatible/OpenAICompatibleAgent";
import { LlamaCppModel } from "../model-types";

/**
 * The GGUF details `llama-server` reports for a model it has loaded. Absent
 * from the listing for a model the router knows about but has not loaded.
 */
export type LlamaCppModelMeta = {
  vocab_type?: number;
  n_vocab?: number;
  /** Context the model was actually loaded with (`--ctx-size`). */
  n_ctx?: number;
  /** Context the model was trained with — its ceiling, not its current size. */
  n_ctx_train?: number;
  n_embd?: number;
  n_params?: number;
  /** On-disk size in bytes. */
  size?: number;
  /** Quantization, e.g. `"Q6_K"`. */
  ftype?: string;
};

/**
 * One entry from a llama.cpp server's `/v1/models`.
 *
 * Everything past the OpenAI-standard fields is optional because it depends on
 * how the server was started: a single-model `llama-server` reports `meta` for
 * the model it is serving and nothing else, while a server in model-router mode
 * lists every model it can serve, each with a `status` saying whether it is
 * currently loaded. Verified against llama.cpp b10148.
 */
export type LlamaCppModelCard = Model & {
  /** Alternative ids that resolve to this model. */
  aliases?: string[];
  tags?: string[];
  /** Router mode only: whether the model is in memory, and how it is launched. */
  status?: {
    value: "loaded" | "unloaded" | (string & {});
    /** The `llama-server` argv the router uses to bring this model up. */
    args?: string[];
    /** The preset block backing this model, as INI text. */
    preset?: string;
  };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  /** Where the router got the model — a config preset or the local HF cache. */
  source?: "preset" | "cache" | (string & {});
  can_remove?: boolean;
  meta?: LlamaCppModelMeta;
};

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

  /**
   * `reasoning_control: true` opts the completion into `llama-server`'s
   * `/chat/completions/control` endpoint — without it, a `reasoning_end`
   * control call is silently ignored and the model keeps thinking. See
   * {@link skipReasoning}.
   */
  protected buildExtraRequestParams(): Record<string, unknown> {
    return { reasoning_control: true };
  }

  /**
   * List the models the server offers, adding the two things llama.cpp reports
   * beyond the OpenAI-standard fields:
   *
   * - `loaded` — in model-router mode a listed model is not necessarily in
   *   memory; an unloaded one has to be loaded before it answers. Left
   *   undefined by a single-model server, which reports no status at all.
   * - `contextLength` — `meta.n_ctx`, the context the model was actually loaded
   *   with, falling back to the trained ceiling `n_ctx_train`. Only loaded
   *   models carry `meta`.
   *
   * `capabilities.vision` follows from the declared input modalities. Tool
   * support is not reported — it depends on the chat template, not the server —
   * so it stays undefined. The rest, launch args and presets and quantization
   * included, is on `raw`.
   */
  async listModels(): Promise<ModelInfo<LlamaCppModelCard>[]> {
    const models = (await super.listModels()) as ModelInfo<LlamaCppModelCard>[];

    return models.map((model) => ({
      ...model,
      loaded: model.raw.status
        ? model.raw.status.value === "loaded"
        : undefined,
      contextLength: model.raw.meta?.n_ctx ?? model.raw.meta?.n_ctx_train,
      capabilities: {
        vision: model.raw.architecture?.input_modalities?.includes("image"),
      },
    }));
  }

  /**
   * Tells the server to end the model's reasoning phase early, mid-stream,
   * via llama.cpp's proprietary `/chat/completions/control` endpoint. Useful
   * for cutting off a model that is thinking for too long without waiting
   * for it to decide to stop on its own.
   *
   * A no-op if no streamed completion is in flight yet (`lastChunkId` unset).
   * Best-effort: a failed request is logged (when `debug` is on) rather than
   * thrown, since this is a side channel to a turn that should otherwise
   * proceed normally.
   */
  async skipReasoning(): Promise<void> {
    if (!this.lastChunkId) return;

    try {
      await fetch(`${this.config.baseURL}/chat/completions/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reasoning_end",
          id: this.lastChunkId,
          model: this.config.model,
        }),
      });
    } catch (error: unknown) {
      if (this.debug) {
        console.error(
          `Failed to signal reasoning_end to ${this.getVendorName()}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  }
}
