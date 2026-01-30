/**
 * Embeddings module for generating vector representations of text.
 *
 * @example
 * ```typescript
 * import { OpenAIEmbeddings, VoyageAIEmbeddings } from "@agentionai/agents/embeddings";
 *
 * // OpenAI embeddings
 * const openaiEmbeddings = new OpenAIEmbeddings({
 *   model: "text-embedding-3-small",
 * });
 *
 * // VoyageAI embeddings
 * const voyageEmbeddings = new VoyageAIEmbeddings({
 *   model: "voyage-4",
 *   inputType: "document",
 * });
 * ```
 */

export { Embeddings, EmbeddingOptions } from "./Embeddings";

export {
  OpenAIEmbeddings,
  OpenAIEmbeddingsConfig,
  OpenAIEmbeddingModel,
} from "./OpenAIEmbeddings";

export {
  VoyageAIEmbeddings,
  VoyageAIEmbeddingsConfig,
  VoyageAIEmbeddingModel,
  VoyageAIMultimodalModel,
} from "./VoyageAIEmbeddings";
