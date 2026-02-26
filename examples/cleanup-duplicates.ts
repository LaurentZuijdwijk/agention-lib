/**
 * Utility script to clean up duplicate documents from a LanceDB vector store.
 *
 * Duplicates are identified by the content hash stored in metadata.
 * For each hash, keeps the first document and deletes the rest.
 *
 * Usage:
 * - Update the store configuration below to match your database
 * - Run with: npm run example -- examples/cleanup-duplicates.ts
 */
import "dotenv/config";
import { LanceDBVectorStore } from "../lib/vectorstore/LanceDBVectorStore";
import { OpenAIEmbeddings } from "../lib/embeddings/OpenAIEmbeddings";

async function cleanupDuplicates() {
  console.log("=== Vector Store Duplicate Cleanup ===\n");

  // Check for required API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is required");
    process.exit(1);
  }

  try {
    // Step 1: Connect to the vector store
    console.log("1. Connecting to vector store...");
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });

    const store = await LanceDBVectorStore.create({
      name: "knowledge_base",
      uri: "./examples/data/vectors",
      tableName: "agention_docs",
      embeddings,
    });
    // Note: No metadataFields needed — this connects to a pre-existing table
    console.log("   Connected\n");

    // Step 2: Get all documents
    console.log("2. Fetching all documents...");
    const table = store.getTable();
    if (!table) throw new Error("Table not found — has data been ingested?");
    const allDocs = await table.query().toArray();
    console.log(`   Found ${allDocs.length} total documents\n`);

    // Step 3: Group by hash
    console.log("3. Identifying duplicates by content hash...");
    const hashGroups = new Map<string, string[]>(); // hash -> [doc_ids]

    for (const doc of allDocs) {
      const docRecord = doc as unknown as {
        id: string;
        chunk_metadata?: { hash?: string };
      };

      const hash = docRecord.chunk_metadata?.hash;
      if (hash) {
        if (!hashGroups.has(hash)) {
          hashGroups.set(hash, []);
        }
        hashGroups.get(hash)!.push(docRecord.id);
      }
    }

    // Step 4: Find duplicate groups
    const duplicateGroups = Array.from(hashGroups.entries()).filter(
      ([_hash, ids]) => ids.length > 1
    );

    console.log(`   Found ${duplicateGroups.length} unique hashes`);
    console.log(`   Found ${duplicateGroups.length} groups with duplicates\n`);

    if (duplicateGroups.length === 0) {
      console.log("✓ No duplicates found! Database is clean.\n");
      process.exit(0);
    }

    // Step 5: Calculate what will be deleted
    let totalDuplicates = 0;
    for (const [_hash, ids] of duplicateGroups) {
      totalDuplicates += ids.length - 1; // Keep first, delete rest
    }

    console.log("4. Duplicate summary:");
    console.log(`   - Total duplicate documents: ${totalDuplicates}`);
    console.log(
      `   - Documents to keep (one per hash): ${duplicateGroups.length}`
    );
    console.log(`   - Documents to delete: ${totalDuplicates}\n`);

    // Show some examples
    console.log("   Example duplicates:");
    for (let i = 0; i < Math.min(5, duplicateGroups.length); i++) {
      const [hash, ids] = duplicateGroups[i];
      console.log(
        `   - Hash ${hash.substring(0, 16)}...: ${ids.length} copies`
      );
    }
    console.log();

    // Step 6: Confirm deletion
    console.log("5. Deleting duplicates (keeping first occurrence)...");

    let deletedCount = 0;
    for (const [_hash, ids] of duplicateGroups) {
      // Keep the first document, delete the rest
      const idsToDelete = ids.slice(1);

      if (idsToDelete.length > 0) {
        const deleted = await store.delete(idsToDelete);
        deletedCount += deleted;
      }
    }

    console.log(`   Deleted ${deletedCount} duplicate documents\n`);

    // Step 7: Verify cleanup
    console.log("6. Verifying cleanup...");
    const remainingDocs = await table.query().toArray();
    console.log(`   Remaining documents: ${remainingDocs.length}`);
    console.log(`   Expected: ${allDocs.length - totalDuplicates}`);

    if (remainingDocs.length === allDocs.length - totalDuplicates) {
      console.log("\n✓ Cleanup successful!\n");
    } else {
      console.log("\n⚠ Warning: Document count mismatch\n");
    }

    // Step 8: Optimize the table
    console.log("7. Optimizing database...");
    await store.optimize();
    console.log("   Done\n");

    console.log("=== Cleanup Complete ===");
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
}

cleanupDuplicates();
