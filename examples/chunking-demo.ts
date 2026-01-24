/**
 * Chunking Demo
 *
 * Demonstrates various chunking strategies without requiring external APIs.
 * Shows how to use different chunker types and configure them for your use case.
 *
 * Run with: npm run example -- examples/chunking-demo.ts
 */

import { TextChunker, RecursiveChunker, TokenChunker } from "../lib";

// Sample document for demonstration
const SAMPLE_DOCUMENT = `# Advanced Machine Learning Guide

## Introduction

Machine learning is a subset of artificial intelligence that enables systems to learn
and improve from experience without being explicitly programmed. This guide covers the
fundamental concepts and practical applications.

## Chapter 1: Fundamentals

### What is Machine Learning?

Machine learning algorithms build a model based on sample data, known as training data,
in order to make predictions or decisions without being explicitly programmed to do so.
The goal is to develop algorithms that can learn from and make predictions on data.

There are three main types of machine learning:

1. **Supervised Learning** - Learning from labeled data
2. **Unsupervised Learning** - Finding patterns in unlabeled data
3. **Reinforcement Learning** - Learning through rewards and penalties

### Key Concepts

**Features** are the input variables used to make predictions. Feature engineering is
often the most important step in building effective models.

**Labels** are the target values we want to predict in supervised learning.

**Models** are mathematical representations of patterns learned from data.

## Chapter 2: Supervised Learning

Supervised learning requires labeled training data. Common algorithms include:

- Linear Regression
- Logistic Regression
- Decision Trees
- Support Vector Machines
- Neural Networks

Each algorithm has strengths and weaknesses depending on your data and problem.

### Training and Evaluation

The process involves:

1. Split data into training and test sets
2. Train the model on training data
3. Evaluate on test data
4. Tune hyperparameters
5. Repeat until performance is acceptable

## Chapter 3: Unsupervised Learning

Unsupervised learning finds hidden patterns in data without labels.

**Clustering** groups similar data points together:
- K-means Clustering
- Hierarchical Clustering
- DBSCAN

**Dimensionality Reduction** reduces the number of features:
- Principal Component Analysis (PCA)
- t-SNE
- Autoencoders

## Chapter 4: Advanced Topics

### Deep Learning

Deep learning uses neural networks with multiple layers to learn hierarchical
representations of data. Applications include:

- Computer Vision (image recognition, object detection)
- Natural Language Processing (translation, sentiment analysis)
- Speech Recognition
- Game Playing

### Transfer Learning

Transfer learning leverages pre-trained models on new tasks, reducing training time
and data requirements significantly.

### Model Deployment

Once trained, models must be deployed in production systems. Considerations include:

- Model serialization and versioning
- API endpoints for predictions
- Monitoring model performance
- Handling model drift over time

## Conclusion

Machine learning is a powerful tool for solving complex problems. Success requires
understanding the fundamentals, choosing appropriate algorithms, and iterating
on your approach based on empirical results.`;

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         Machine Learning Document Chunking Demo            ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  // ==================== Example 1: TextChunker ====================
  console.log("📝 Example 1: TextChunker (Character-based)\n");
  console.log("The TextChunker splits text by a fixed number of characters.");
  console.log("Good for: Uniform chunks, simple use cases\n");

  const textChunker = new TextChunker({
    chunkSize: 400,
    chunkOverlap: 50,
  });

  const textChunks = await textChunker.chunk(SAMPLE_DOCUMENT, {
    sourceId: "ml-guide-v1",
    sourcePath: "/docs/ml-guide.md",
    metadata: {
      category: "educational",
      difficulty: "intermediate",
    },
  });

  console.log(`Created ${textChunks.length} chunks:\n`);
  for (let i = 0; i < Math.min(3, textChunks.length); i++) {
    const chunk = textChunks[i];
    console.log(`Chunk ${i + 1}:`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Size: ${chunk.metadata.charCount} characters`);
    console.log(`  Preview: ${chunk.content.substring(0, 80)}...`);
    console.log();
  }

  // ==================== Example 2: RecursiveChunker ====================
  console.log("\n🔍 Example 2: RecursiveChunker (Semantic boundaries)\n");
  console.log(
    "The RecursiveChunker splits on semantic boundaries (paragraphs, sections)"
  );
  console.log("Good for: Markdown, documents with clear structure\n");

  const recursiveChunker = new RecursiveChunker({
    chunkSize: 500,
    chunkOverlap: 75,
    separators: ["\n\n", "\n### ", "\n## ", "\n# ", ". ", " "],
  });

  const recursiveChunks = await recursiveChunker.chunk(SAMPLE_DOCUMENT, {
    sourceId: "ml-guide-v1",
    sourcePath: "/docs/ml-guide.md",
    metadata: {
      category: "educational",
      difficulty: "intermediate",
    },
  });

  console.log(`Created ${recursiveChunks.length} chunks:\n`);
  for (let i = 0; i < Math.min(4, recursiveChunks.length); i++) {
    const chunk = recursiveChunks[i];
    console.log(`Chunk ${i + 1}:`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Section: ${chunk.metadata.sectionTitle || "Unknown"}`);
    console.log(`  Size: ${chunk.metadata.charCount} characters`);
    console.log(`  Level: ${chunk.metadata.nLevel || 0}`);
    console.log();
  }

  // ==================== Example 3: TokenChunker ====================
  console.log("\n⚙️  Example 3: TokenChunker (Token-aware)\n");
  console.log("The TokenChunker respects token limits for LLM compatibility");
  console.log("Good for: LLM processing, consistent token counts\n");

  try {
    const tokenChunker = new TokenChunker({
      chunkSize: 250,
      chunkOverlap: 25,
    });

    const tokenChunks = await tokenChunker.chunk(SAMPLE_DOCUMENT, {
      sourceId: "ml-guide-v1",
    });

    console.log(`Created ${tokenChunks.length} chunks:\n`);
    console.log("Token distribution:");
    const tokenCounts = tokenChunks.map((c) => c.metadata.tokenCount || 0);
    const avgTokens = Math.round(
      tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length
    );
    const minTokens = Math.min(...tokenCounts);
    const maxTokens = Math.max(...tokenCounts);

    console.log(`  Average: ${avgTokens} tokens`);
    console.log(`  Min: ${minTokens} tokens`);
    console.log(`  Max: ${maxTokens} tokens`);
    console.log();
  } catch (error) {
    console.log(
      "Note: TokenChunker requires building with --loader ts-node/esm"
    );
    console.log(
      "For now, use: node --loader ts-node/esm examples/chunking-demo.ts\n"
    );
  }

  // ==================== Example 4: Custom Processing ====================
  console.log("\n🛠️  Example 4: Custom Chunk Processing\n");
  console.log("Apply custom transformations to chunks during processing.\n");

  const processingChunker = new TextChunker({
    chunkSize: 300,
    chunkOverlap: 30,
    chunkProcessor: (chunk) => {
      // Filter chunks that are too short
      if (chunk.content.trim().length < 50) {
        return null;
      }

      // Count sentences
      const sentences = chunk.content.split(/[.!?]+/).filter((s) => s.trim());

      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          sentenceCount: sentences.length,
          processedAt: new Date().toISOString(),
        },
      };
    },
  });

  const processedChunks = await processingChunker.chunk(SAMPLE_DOCUMENT);

  console.log(`Created ${processedChunks.length} chunks after processing:\n`);
  for (let i = 0; i < Math.min(3, processedChunks.length); i++) {
    const chunk = processedChunks[i];
    console.log(`Chunk ${i + 1}:`);
    console.log(`  Sentences: ${chunk.metadata.sentenceCount}`);
    console.log(`  Size: ${chunk.metadata.charCount} characters`);
    console.log(`  Processed: ${chunk.metadata.processedAt}`);
    console.log();
  }

  // ==================== Example 5: Chunk Navigation ====================
  console.log("\n🔗 Example 5: Chunk Navigation\n");
  console.log("Chunks maintain references for sequential navigation.\n");

  const navChunks = await textChunker.chunk(
    "Chunk 1. Chunk 2. Chunk 3. Chunk 4.",
    {
      sourceId: "simple-doc",
    }
  );

  console.log(`Chain of ${navChunks.length} chunks:\n`);
  for (let i = 0; i < navChunks.length; i++) {
    const chunk = navChunks[i];
    const prevLabel = chunk.metadata.previousChunkId
      ? chunk.metadata.previousChunkId.substring(0, 8)
      : "START";
    const nextLabel = chunk.metadata.nextChunkId
      ? chunk.metadata.nextChunkId.substring(0, 8)
      : "END";

    console.log(`[${prevLabel}] → Chunk ${i + 1} → [${nextLabel}]`);
  }
  console.log();

  // ==================== Example 6: Comparison ====================
  console.log("\n📊 Example 6: Chunker Comparison\n");

  const testText = `Introduction to AI. Machine learning is powerful. Deep learning uses neural networks.
  Transformers revolutionized NLP. Vision models process images. Multimodal models combine text and images.
  Large language models show emergent capabilities. Fine-tuning adapts models to tasks.`;

  console.log("Input text length: " + testText.length + " characters\n");
  console.log("Strategy               | Chunks | Avg Size | Comments");
  console.log("─".repeat(65));

  // TextChunker comparison
  const tc = new TextChunker({ chunkSize: 150, chunkOverlap: 0 });
  const tcChunks = await tc.chunk(testText);
  const tcAvg = Math.round(
    tcChunks.reduce((a, c) => a + c.metadata.charCount, 0) / tcChunks.length
  );
  console.log(
    `TextChunker (150)     | ${String(tcChunks.length).padEnd(6)}| ${String(
      tcAvg
    ).padEnd(8)}| Uniform chunks`
  );

  // RecursiveChunker comparison
  const rc = new RecursiveChunker({ chunkSize: 150, chunkOverlap: 0 });
  const rcChunks = await rc.chunk(testText);
  const rcAvg = Math.round(
    rcChunks.reduce((a, c) => a + c.metadata.charCount, 0) / rcChunks.length
  );
  console.log(
    `RecursiveChunker (150)| ${String(rcChunks.length).padEnd(6)}| ${String(
      rcAvg
    ).padEnd(8)}| Respects sentences`
  );

  // TokenChunker comparison (skip if not available)
  try {
    const tk = new TokenChunker({ chunkSize: 40, chunkOverlap: 0 });
    const tkChunks = await tk.chunk(testText);
    const tkAvg = Math.round(
      tkChunks.reduce((a, c) => a + (c.metadata.tokenCount || 0), 0) /
        tkChunks.length
    );
    console.log(
      `TokenChunker (40 toks)| ${String(tkChunks.length).padEnd(6)}| ${String(
        tkAvg
      ).padEnd(8)}| Token-aware`
    );
  } catch (error) {
    console.log(
      `TokenChunker (40 toks)| N/A    | N/A     | (requires ESM loader)`
    );
  }

  console.log("\n✅ Chunking demo complete!\n");
}

main().catch(console.error);
