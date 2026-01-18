/**
 * Data Fetcher Factories
 *
 * Demonstrates the factory pattern for creating data-fetching GraphNodes.
 * Factories capture context (user permissions, tenant, config) at creation time,
 * keeping the pipeline data flow simple (string -> string).
 */

import { GraphNode } from "../../../lib/graph/AgentGraph";

// ============================================================================
// Types
// ============================================================================

export interface UserContext {
  userId: string;
  tenantId: string;
  permissions: string[];
}

export interface DatabaseConfig {
  connectionString?: string;
  timeout?: number;
}

export interface ApiConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

// ============================================================================
// Database Fetcher Factory
// ============================================================================

/**
 * Creates a database fetcher with user context baked in.
 * The returned GraphNode only needs a topic string - auth is handled internally.
 */
export function createDatabaseFetcher(
  userContext: UserContext,
  config: DatabaseConfig = {}
): GraphNode<string, string> {
  // Simulated database with access control
  const mockDatabase: Record<string, { data: string; requiredPermission: string }> = {
    "penicillin": {
      data: "Internal records: Alexander Fleming discovered penicillin in 1928 at St. Mary's Hospital London. Mass production began 1942. Patents filed 1940-1945. Estimated 200M lives saved.",
      requiredPermission: "read:medical",
    },
    "quantum computing": {
      data: "Internal records: Shor's algorithm (1994), Google quantum supremacy (2019), IBM 1000+ qubit processor (2023). Active research projects: QC-7, QC-12.",
      requiredPermission: "read:tech",
    },
    "financials": {
      data: "Q4 Revenue: $12.3M, YoY Growth: 23%, EBITDA margin: 18%. Confidential projections attached.",
      requiredPermission: "read:finance",
    },
    "climate change": {
      data: "Internal research: IPCC data analysis, Paris Agreement compliance tracking, carbon offset calculations for FY2023.",
      requiredPermission: "read:research",
    },
  };

  return {
    name: `DatabaseFetcher[${userContext.userId}]`,
    nodeType: "custom",
    execute: async (topic: string) => {
      console.log(`  [DB] User ${userContext.userId} querying: "${topic}"`);
      console.log(`  [DB] Tenant: ${userContext.tenantId}, Permissions: ${userContext.permissions.join(", ")}`);

      // Simulate database delay
      await new Promise((resolve) => setTimeout(resolve, config.timeout ?? 100));

      // Find matching records
      const key = Object.keys(mockDatabase).find((k) =>
        topic.toLowerCase().includes(k)
      );

      if (!key) {
        console.log(`  [DB] No records found`);
        return `[Database] No internal records found for "${topic}".`;
      }

      const record = mockDatabase[key];

      // Check permissions
      if (!userContext.permissions.includes(record.requiredPermission)) {
        console.log(`  [DB] Access denied - requires ${record.requiredPermission}`);
        return `[Database] Access denied. You don't have permission to access records about "${key}".`;
      }

      console.log(`  [DB] Access granted - returning data`);
      return `[Database] ${record.data}`;
    },
  };
}

// ============================================================================
// Web/API Fetcher Factory
// ============================================================================

/**
 * Creates a web API fetcher with configuration baked in.
 * In production, replace mock data with actual fetch() calls.
 */
export function createWebFetcher(
  config: ApiConfig = {}
): GraphNode<string, string> {
  // Simulated web API responses
  const mockWebData: Record<string, string> = {
    "penicillin": "Wikipedia: Penicillin is a group of antibiotics derived from Penicillium fungi. Discovery credited to Alexander Fleming (1928). Nobel Prize in Physiology/Medicine (1945) shared with Florey and Chain.",
    "quantum computing": "Latest news: Quantum computing market expected to reach $65B by 2030. Recent breakthroughs in error correction. IBM, Google, and IonQ leading commercial efforts.",
    "climate change": "Current data: 2023 confirmed as hottest year on record. Global average temperature 1.45°C above pre-industrial levels. COP28 agreements under implementation.",
  };

  return {
    name: "WebFetcher",
    nodeType: "custom",
    execute: async (topic: string) => {
      console.log(`  [WEB] Fetching external data for: "${topic}"`);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, config.timeout ?? 150));

      const key = Object.keys(mockWebData).find((k) =>
        topic.toLowerCase().includes(k)
      );

      if (!key) {
        console.log(`  [WEB] No relevant data found`);
        return `[Web] No relevant external data found for "${topic}".`;
      }

      console.log(`  [WEB] Data retrieved`);
      return `[Web] ${mockWebData[key]}`;
    },
  };
}

// ============================================================================
// Vector Database Fetcher Factory (placeholder for future)
// ============================================================================

/**
 * Creates a vector database fetcher for semantic search.
 * Placeholder for future vector DB integration.
 */
export function createVectorDbFetcher(
  userContext: UserContext,
  config: { collection?: string; topK?: number } = {}
): GraphNode<string, string> {
  return {
    name: `VectorDBFetcher[${config.collection ?? "default"}]`,
    nodeType: "custom",
    execute: async (topic: string) => {
      console.log(`  [VECTOR] Semantic search for: "${topic}"`);
      console.log(`  [VECTOR] Collection: ${config.collection ?? "default"}, TopK: ${config.topK ?? 5}`);

      // Simulate vector search delay
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Mock semantic search results
      return `[VectorDB] Found 3 semantically similar documents for "${topic}". Top match (similarity: 0.89): "Related research document..."`;
    },
  };
}
