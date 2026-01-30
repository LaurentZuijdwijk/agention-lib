import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { LanceDBVectorStore } from "../lib/vectorstore/LanceDBVectorStore";
import { OpenAIEmbeddings } from "../lib/embeddings/OpenAIEmbeddings";

/**
 * Example demonstrating multi-tenancy and filtering in vector stores.
 *
 * Shows how to:
 * 1. Store documents with tenant/project metadata
 * 2. Create tenant-specific retrieval tools
 * 3. Ensure agents only access documents for their tenant
 */

// Sample multi-tenant data
const DOCUMENTS = [
  // Tenant: Acme Corp
  {
    id: "acme-1",
    content:
      "Acme Corp uses a monthly billing cycle. Invoices are sent on the 1st of each month.",
    metadata: { tenantId: "acme", projectId: "proj-123", category: "billing" },
  },
  {
    id: "acme-2",
    content: "Acme Corp's support hours are Monday-Friday, 9am-5pm EST.",
    metadata: { tenantId: "acme", projectId: "proj-123", category: "support" },
  },
  {
    id: "acme-3",
    content: "Acme Corp has a 30-day refund policy for all services.",
    metadata: { tenantId: "acme", projectId: "proj-456", category: "policy" },
  },

  // Tenant: TechStart Inc
  {
    id: "techstart-1",
    content:
      "TechStart Inc uses annual billing. Payment is due within 15 days of invoice.",
    metadata: {
      tenantId: "techstart",
      projectId: "proj-789",
      category: "billing",
    },
  },
  {
    id: "techstart-2",
    content:
      "TechStart Inc offers 24/7 premium support for enterprise customers.",
    metadata: {
      tenantId: "techstart",
      projectId: "proj-789",
      category: "support",
    },
  },
  {
    id: "techstart-3",
    content: "TechStart Inc has a 60-day money-back guarantee.",
    metadata: {
      tenantId: "techstart",
      projectId: "proj-789",
      category: "policy",
    },
  },

  // Tenant: Global Services
  {
    id: "global-1",
    content:
      "Global Services bills quarterly. Invoices are sent 15 days before the period ends.",
    metadata: {
      tenantId: "global",
      projectId: "proj-101",
      category: "billing",
    },
  },
  {
    id: "global-2",
    content:
      "Global Services provides support in 12 languages, available 24/7.",
    metadata: {
      tenantId: "global",
      projectId: "proj-202",
      category: "support",
    },
  },
];

async function vectorStoreFilteringExample() {
  console.log("Multi-Tenancy Vector Store Example\n");
  console.log("===================================\n");

  // Check for required API keys
  if (!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.error("Error: OPENAI_API_KEY and ANTHROPIC_API_KEY are required");
    process.exit(1);
  }

  try {
    // Step 1: Create embeddings and vector store
    console.log("1. Creating vector store...");
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });

    const store = await LanceDBVectorStore.create({
      name: "multi_tenant_kb",
      uri: "./examples/data/vectors-filtered",
      tableName: "tenant_docs",
      embeddings,
    });
    console.log("   Store created\n");

    // Step 2: Add documents with tenant metadata
    console.log("2. Adding documents for multiple tenants...");
    await store.addDocuments(DOCUMENTS);
    console.log(`   Added ${DOCUMENTS.length} documents\n`);

    // Step 3: Test filtering directly
    console.log("3. Testing direct search with filters...\n");

    console.log("   Searching for billing info (no filter):");
    const allBilling = await store.search("billing cycle", {
      limit: 3,
      filter: { category: "billing" },
    });
    for (const result of allBilling) {
      console.log(
        `   - [${result.score.toFixed(3)}] ${
          result.document.metadata?.tenantId
        }: ${result.document.content}`
      );
    }
    console.log();

    console.log("   Searching for billing info (Acme only):");
    const acmeBilling = await store.search("billing cycle", {
      limit: 3,
      filter: { tenantId: "acme", category: "billing" },
    });
    for (const result of acmeBilling) {
      console.log(
        `   - [${result.score.toFixed(3)}] ${
          result.document.metadata?.tenantId
        }: ${result.document.content}`
      );
    }
    console.log();

    // Step 4: Create tenant-specific agents
    console.log("4. Creating tenant-specific agents...\n");

    // Acme Corp agent - can only access Acme documents
    const acmeSearchTool = store.toRetrievalTool(
      "Search the Acme Corp knowledge base for billing, support, and policy information",
      {
        defaultLimit: 3,
        defaultFilter: { tenantId: "acme" }, // Always filter to Acme
        allowFilterOverride: false, // Agent cannot override this filter
      }
    );

    const acmeAgent = new ClaudeAgent({
      id: "acme-agent",
      name: "Acme Support Agent",
      description:
        "You are a customer support agent for Acme Corp. Use the search tool to find accurate information.",
      apiKey: process.env.ANTHROPIC_API_KEY as string,
      tools: [acmeSearchTool],
      model: "claude-sonnet-4-20250514",
    });

    // TechStart agent - can only access TechStart documents
    const techstartSearchTool = store.toRetrievalTool(
      "Search the TechStart Inc knowledge base for billing, support, and policy information",
      {
        defaultLimit: 3,
        defaultFilter: { tenantId: "techstart" },
        allowFilterOverride: false,
      }
    );

    const techstartAgent = new ClaudeAgent({
      id: "techstart-agent",
      name: "TechStart Support Agent",
      description:
        "You are a customer support agent for TechStart Inc. Use the search tool to find accurate information.",
      apiKey: process.env.ANTHROPIC_API_KEY as string,
      tools: [techstartSearchTool],
      model: "claude-sonnet-4-20250514",
    });

    // Step 5: Test tenant isolation
    console.log("5. Testing tenant isolation...\n");

    const question = "What is the billing cycle?";

    console.log(`   Question: "${question}"\n`);

    console.log("   Acme Agent Response:");
    const acmeResponse = await acmeAgent.execute(question);
    console.log(`   ${acmeResponse}\n`);

    console.log("   TechStart Agent Response:");
    const techstartResponse = await techstartAgent.execute(question);
    console.log(`   ${techstartResponse}\n`);

    // Step 6: Demonstrate project-level filtering with override
    console.log("6. Creating agent with filter override capability...\n");

    const flexibleSearchTool = store.toRetrievalTool(
      "Search the knowledge base. You can filter by tenantId, projectId, or category.",
      {
        defaultLimit: 3,
        defaultFilter: { tenantId: "acme" }, // Default to Acme
        allowFilterOverride: true, // But allow overriding
      }
    );

    const flexibleAgent = new ClaudeAgent({
      id: "flexible-agent",
      name: "Flexible Search Agent",
      description: `You are a knowledge base assistant. Use the search tool with appropriate filters.
      When asked about a specific project, use the projectId filter.
      When asked about a category, use the category filter.`,
      apiKey: process.env.ANTHROPIC_API_KEY as string,
      tools: [flexibleSearchTool],
      model: "claude-sonnet-4-20250514",
    });

    console.log(
      '   Question: "What is the support policy for project proj-789?"\n'
    );
    const projectResponse = await flexibleAgent.execute(
      "What is the support policy for project proj-789?"
    );
    console.log(`   Response: ${projectResponse}\n`);

    // Step 7: Demonstrate adding documents with default metadata
    console.log("7. Adding new document with automatic tenant tagging...\n");

    const acmeAddTool = store.toAddDocumentsTool(
      "Add new documents to the Acme Corp knowledge base",
      {
        defaultMetadata: {
          tenantId: "acme",
          projectId: "proj-123",
          addedBy: "system",
        },
      }
    );

    const addAgent = new ClaudeAgent({
      id: "add-agent",
      name: "Document Manager",
      description: "You help add new documents to the knowledge base.",
      apiKey: process.env.ANTHROPIC_API_KEY as string,
      tools: [acmeAddTool],
      model: "claude-sonnet-4-20250514",
    });

    console.log("   Adding: 'Acme Corp offers a new premium support tier.'\n");
    await addAgent.execute(
      "Add a document with id 'acme-4' and content: 'Acme Corp offers a new premium support tier with 24/7 assistance.'"
    );

    // Verify it was added with correct metadata
    const newDoc = await store.getById("acme-4");
    console.log("   Document added with metadata:");
    console.log(`   ${JSON.stringify(newDoc?.metadata, null, 2)}\n`);

    console.log("✅ Multi-tenancy example completed successfully!\n");
    console.log("Key takeaways:");
    console.log("- Use defaultFilter to enforce tenant isolation");
    console.log("- Set allowFilterOverride: false for strict security");
    console.log("- Use defaultMetadata to auto-tag documents");
    console.log(
      "- Combine filters (tenant + project + category) for fine-grained control"
    );

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

vectorStoreFilteringExample();
