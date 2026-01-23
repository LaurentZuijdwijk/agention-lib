const neo4j = require("neo4j-driver");

// Neo4j connection details
const uri = "bolt://localhost:7687";
const user = "neo4j";
const password = "your_password";

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

// Helper function to generate random vectors
function generateRandomVector(dim) {
  return Array.from({ length: dim }, () => (Math.random() * 2 - 1).toFixed(4));
}

async function runTests() {
  const session = driver.session();

  try {
    // Clear the database
    await session.run("MATCH (n) DETACH DELETE n");
    console.log("Database cleared.");

    // Insert nodes with vector embeddings
    const items = [
      { name: "Item1", embedding: generateRandomVector(3) },
      { name: "Item2", embedding: generateRandomVector(3) },
      { name: "Item3", embedding: generateRandomVector(3) },
    ];

    for (const item of items) {
      await session.run(
        "CREATE (i:Item {name: $name, embedding: $embedding})",
        { name: item.name, embedding: item.embedding.map(Number) }
      );
      console.log(
        `Inserted node: ${item.name} with embedding ${item.embedding}`
      );
    }

    // Perform vector similarity search (cosine similarity)
    const queryVector = generateRandomVector(3);
    console.log(`Querying with vector: ${queryVector}`);

    const result = await session.run(
      `
      MATCH (i:Item)
      WITH i, $queryVector AS query
      RETURN i.name, i.embedding,
             gds.similarity.cosine(i.embedding, query) AS similarity
      ORDER BY similarity DESC
      LIMIT 2
      `,
      { queryVector: queryVector.map(Number) }
    );

    console.log("Vector similarity search results:");
    result.records.forEach((record) => {
      console.log(
        `Item: ${record.get("i.name")}, Embedding: ${record.get(
          "i.embedding"
        )}, Similarity: ${record.get("similarity")}`
      );
    });

    // Create a simple graph with relationships
    await session.run(
      `
      MATCH (i1:Item {name: 'Item1'}), (i2:Item {name: 'Item2'})
      CREATE (i1)-[:RELATED_TO {weight: 0.8}]->(i2)
      `
    );
    console.log("Created relationship between Item1 and Item2.");

    // Query the graph
    const graphResult = await session.run(
      `
      MATCH (i:Item)-[r:RELATED_TO]->(other)
      RETURN i.name, type(r), other.name, r.weight
      `
    );

    console.log("Graph query results:");
    graphResult.records.forEach((record) => {
      console.log(
        `From: ${record.get("i.name")} -> ${record.get(
          "other.name"
        )} via ${record.get("type(r)")}, Weight: ${record.get("r.weight")}`
      );
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the tests
runTests();
