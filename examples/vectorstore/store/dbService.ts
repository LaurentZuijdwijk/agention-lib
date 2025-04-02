import "dotenv/config";
import * as lancedb from "@lancedb/lancedb";
import * as arrow from "apache-arrow";

import { Utf8 } from "apache-arrow";
import { embedding } from "@lancedb/lancedb";
import "@lancedb/lancedb/embedding/openai";
// import { EmbeddingFunction, getRegistry } from "@lancedb/lancedb/embedding";

const setup = async () => {
  const db = await lancedb.connect("./");

  // const _tbl =
  // await db.createTable(
  //   "myTable",
  //   { mode: "overwrite" }
  // );
  let tbl: lancedb.Table;
  // console.log(process.env.OPENAI_API_KEY);
  // const apiKey = process.env.OPENAI_API_KEY;
  // await db.dropTable("words");
  const tableNames = await db.tableNames();

  if (tableNames.includes("words")) {
    tbl = await db.openTable("words");
  } else {
    const func = embedding.getRegistry().get("openai")?.create({
      model: "text-embedding-ada-002",
      // apiKey,
    });

    // const func = embedding.getRegistry()!.get("openai")!.create({
    //   model: "text-embedding-ada-002",
    //   apiKey: process.env.OPENAI_API_KEY,
    // });
    const wordsSchema = embedding.LanceSchema({
      text: func!.sourceField(new Utf8()),
      vector: func!.vectorField(),
      id: new arrow.Int32(),
    });
    tbl = await db.createEmptyTable("words", wordsSchema, {
      mode: "overwrite",
    });

    await tbl.add([
      { text: "hello world", id: 1 },
      { text: "goodbye world", id: 2 },
    ]);
  }

  console.log(tableNames);
  await tbl.add([
    {
      text: "The world says hello and goodbye to the person who is coming and going",
      id: 3,
    },
    {
      text: `LanceDB registers the Sentence Transformers embeddings function in the registry as sentence-transformers. You can pass any supported model name to the create. By default it uses "sentence-transformers/paraphrase-MiniLM-L6-v2".`,
      id: 4,
    },
  ]);

  // const data = [
  //   { vector: [1.3, 1.4], item: "fizz", price: 100.0 },
  //   { vector: [9.5, 56.2], item: "buzz", price: 200.0 },
  // ];

  const query = "Sentence Transformers";
  const actual = await tbl.search(query).where("id > 2").limit(2).toArray();

  // await tbl.delete("id = 4");
  // const res = await tbl.search([100, 100]).limit(2).toArray();
  actual.forEach(({ text, id }) => console.log(text, id));
  console.log((await tbl.query().where("id = 4").limit(10).toArray()).length);

  // console.log(actual.text);
  // await tbl.add(data);
};

setup();
