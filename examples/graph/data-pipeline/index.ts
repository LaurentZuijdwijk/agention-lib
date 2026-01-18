/**
 * Data Pipeline Example
 *
 * Demonstrates the factory pattern for creating data-fetching pipelines.
 *
 * Key concepts:
 * - Factories capture context (user, config) at creation time
 * - Pipeline data flow stays simple (string -> string)
 * - Security/permissions are handled at the factory level
 * - Easy to compose different fetchers for different use cases
 *
 * Run with: npx ts-node examples/graph/data-pipeline/index.ts
 */

import "dotenv/config";
import {
  AgentGraph,
  GraphNode,
  createMetricsCollector,
} from "../../../lib/graph/AgentGraph";
import {
  createDatabaseFetcher,
  createWebFetcher,
  createVectorDbFetcher,
  UserContext,
} from "./fetchers";
import { createPipelineAgents } from "./agents";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("Please set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

// ============================================================================
// Helper: Combine Multiple Data Sources
// ============================================================================

/**
 * Creates a node that combines results from multiple fetchers.
 * Each fetcher runs in parallel, results are concatenated.
 */
function createDataCombiner(
  ...fetchers: GraphNode<string, string>[]
): GraphNode<string, string> {
  return {
    name: "DataCombiner",
    nodeType: "custom",
    execute: async (topic: string) => {
      console.log(`\n  [COMBINE] Fetching from ${fetchers.length} sources in parallel...`);

      // Run all fetchers in parallel
      const results = await Promise.all(
        fetchers.map((f) => f.execute(topic))
      );

      // Combine results with clear separation
      return results.join("\n\n");
    },
  };
}

// ============================================================================
// Example 1: Basic Data Pipeline with Permissions
// ============================================================================

async function runBasicPipeline() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Example 1: Basic Data Pipeline with Permissions             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Simulate a user with limited permissions
  const regularUser: UserContext = {
    userId: "user-123",
    tenantId: "acme-corp",
    permissions: ["read:tech", "read:research"],
  };

  // Create fetchers with user context baked in
  const dbFetcher = createDatabaseFetcher(regularUser);
  const webFetcher = createWebFetcher();

  // Create agents
  const { summarizerAgent } = createPipelineAgents(apiKey);

  // Build pipeline: Combine sources -> Summarize
  const pipeline = AgentGraph.pipeline<string, string>(
    createDataCombiner(dbFetcher, webFetcher),
    AgentGraph.sequential({ wrapInput: false }, summarizerAgent)
  );

  console.log("User:", regularUser.userId);
  console.log("Permissions:", regularUser.permissions.join(", "));
  console.log("\n--- Running pipeline for 'quantum computing' ---\n");

  const result = await pipeline.execute("quantum computing");

  console.log("\n=== Result ===\n");
  console.log(result);
}

// ============================================================================
// Example 2: Access Denied Scenario
// ============================================================================

async function runAccessDeniedExample() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Example 2: Access Denied Scenario                           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // User without finance permissions
  const limitedUser: UserContext = {
    userId: "intern-456",
    tenantId: "acme-corp",
    permissions: ["read:research"], // No finance access
  };

  const dbFetcher = createDatabaseFetcher(limitedUser);
  const { summarizerAgent } = createPipelineAgents(apiKey);

  const pipeline = AgentGraph.pipeline<string, string>(
    dbFetcher,
    AgentGraph.sequential({ wrapInput: false }, summarizerAgent)
  );

  console.log("User:", limitedUser.userId);
  console.log("Permissions:", limitedUser.permissions.join(", "));
  console.log("\n--- Attempting to access 'financials' ---\n");

  const result = await pipeline.execute("financials");

  console.log("\n=== Result ===\n");
  console.log(result);
}

// ============================================================================
// Example 3: Multi-Source Research Pipeline
// ============================================================================

async function runMultiSourcePipeline() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Example 3: Multi-Source Research Pipeline                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Admin user with full access
  const adminUser: UserContext = {
    userId: "admin-001",
    tenantId: "acme-corp",
    permissions: ["read:tech", "read:research", "read:medical", "read:finance"],
  };

  // Create multiple fetchers
  const dbFetcher = createDatabaseFetcher(adminUser);
  const webFetcher = createWebFetcher();
  const vectorFetcher = createVectorDbFetcher(adminUser, {
    collection: "research-papers",
    topK: 3
  });

  // Create agents
  const { analyzerAgent, summarizerAgent } = createPipelineAgents(apiKey);

  // Create metrics collector
  const metrics = createMetricsCollector();

  // Build comprehensive research pipeline
  const researchPipeline = AgentGraph.pipeline<string, string>(
    // Stage 1: Fetch from all sources in parallel
    createDataCombiner(dbFetcher, webFetcher, vectorFetcher),

    // Stage 2: Deep analysis
    AgentGraph.sequential({ wrapInput: false }, analyzerAgent),

    // Stage 3: Executive summary
    AgentGraph.sequential({ wrapInput: false }, summarizerAgent)
  ).withMetrics(metrics);

  console.log("User:", adminUser.userId);
  console.log("Data sources: Database, Web, VectorDB");
  console.log("\n--- Running comprehensive research on 'penicillin' ---\n");

  const result = await researchPipeline.execute("penicillin");

  console.log("\n=== Executive Summary ===\n");
  console.log(result);

  // Show metrics
  console.log("\n=== Pipeline Metrics ===\n");
  console.log(metrics.toTextVisualization());

  const aggregate = metrics.getAggregateMetrics();
  console.log(`\nTotal duration: ${aggregate.totalDurationMs}ms`);
  console.log(`Total tokens: ${aggregate.totalTokens.totalTokens}`);
}

// ============================================================================
// Example 4: Dynamic Pipeline Based on User Role
// ============================================================================

async function runRoleBasedPipeline() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Example 4: Dynamic Pipeline Based on User Role              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  /**
   * Factory that creates different pipelines based on user role.
   * Demonstrates how to compose pipelines dynamically.
   */
  function createPipelineForUser(
    user: UserContext & { role: "basic" | "researcher" | "admin" }
  ): GraphNode<string, string> {
    const { summarizerAgent, analyzerAgent } = createPipelineAgents(apiKey);

    switch (user.role) {
      case "basic":
        // Basic users only get web data
        console.log(`Creating basic pipeline for ${user.userId}`);
        return AgentGraph.pipeline(
          createWebFetcher(),
          AgentGraph.sequential({ wrapInput: false }, summarizerAgent)
        );

      case "researcher":
        // Researchers get DB + web
        console.log(`Creating researcher pipeline for ${user.userId}`);
        return AgentGraph.pipeline(
          createDataCombiner(
            createDatabaseFetcher(user),
            createWebFetcher()
          ),
          AgentGraph.sequential({ wrapInput: false }, analyzerAgent),
          AgentGraph.sequential({ wrapInput: false }, summarizerAgent)
        );

      case "admin":
        // Admins get everything
        console.log(`Creating admin pipeline for ${user.userId}`);
        return AgentGraph.pipeline(
          createDataCombiner(
            createDatabaseFetcher(user),
            createWebFetcher(),
            createVectorDbFetcher(user)
          ),
          AgentGraph.sequential({ wrapInput: false }, analyzerAgent),
          AgentGraph.sequential({ wrapInput: false }, summarizerAgent)
        );
    }
  }

  // Test with different roles
  const basicUser = {
    userId: "basic-user",
    tenantId: "acme-corp",
    permissions: [],
    role: "basic" as const,
  };

  const pipeline = createPipelineForUser(basicUser);

  console.log("\n--- Running with basic user role ---\n");

  const result = await pipeline.execute("climate change");

  console.log("\n=== Result ===\n");
  console.log(result);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  await runBasicPipeline();
  await runAccessDeniedExample();
  await runMultiSourcePipeline();
  await runRoleBasedPipeline();

  console.log("\n✓ All examples completed");
}

main().catch(console.error);
