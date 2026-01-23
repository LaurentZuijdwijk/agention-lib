/**
 * Vector Store module for document storage and semantic retrieval.
 *
 * @example
 * ```typescript
 * import { LanceDBVectorStore, OpenAIEmbeddings } from "@agentionai/agents";
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
} from "./VectorStore";

export { Embeddings, EmbeddingOptions } from "./Embeddings";

export { OpenAIEmbeddings, OpenAIEmbeddingsConfig } from "./OpenAIEmbeddings";

export {
  LanceDBVectorStore,
  LanceDBVectorStoreConfig,
} from "./LanceDBVectorStore";
