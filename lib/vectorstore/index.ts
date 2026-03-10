/**
 * Vector Store module for document storage and semantic retrieval.
 *
 * @example
 * ```typescript
 * import { LanceDBVectorStore } from "@agentionai/agents";
 * import { OpenAIEmbeddings } from "@agentionai/agents/embeddings";
 *
 * const embeddings = new OpenAIEmbeddings({
 *   model: "text-embedding-3-small",
 * });
 *
 * const store = await LanceDBVectorStore.create({
 *   name: "docs",
 *   uri: "./data",
 *   tableName: "documents",
 *   embeddings,
 * });
 *
 * // Create tools for agents
 * const searchTool = store.toRetrievalTool("Search documentation");
 * const addTool = store.toAddDocumentsTool("Save new documents");
 * ```
 */

export {
  VectorStore,
  Document,
  EmbeddedDocument,
  SearchResult,
  AddDocumentsOptions,
  SearchOptions,
  DeleteOptions,
  RetrievalToolOptions,
  AddDocumentsToolOptions,
  MetadataFieldType,
  MetadataFieldDefinition,
} from "./VectorStore";

export {
  LanceDBVectorStore,
  LanceDBVectorStoreConfig,
} from "./LanceDBVectorStore";

export {
  OpenSearchVectorStore,
  OpenSearchVectorStoreConfig,
  OpenSearchSpaceType,
  OpenSearchKnnEngine,
} from "./OpenSearchVectorStore";

// Re-export embeddings for backward compatibility
export { Embeddings, EmbeddingOptions } from "../embeddings/Embeddings";
export {
  OpenAIEmbeddings,
  OpenAIEmbeddingsConfig,
  OpenAIEmbeddingModel,
} from "../embeddings/OpenAIEmbeddings";
export {
  VoyageAIEmbeddings,
  VoyageAIEmbeddingsConfig,
  VoyageAIEmbeddingModel,
  VoyageAIMultimodalModel,
} from "../embeddings/VoyageAIEmbeddings";
