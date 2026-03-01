import "dotenv/config";
/**
 * Multimodal example — sending images to Claude and OpenAI
 *
 * Run:  ANTHROPIC_API_KEY=... npx ts-node examples/multimodal.ts
 *
 * Images are always passed directly to execute() as a MessageContent array.
 * Use imageUrl() for remote URLs and imageBase64() for local files.
 */

import * as fs from "fs";
import * as path from "path";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { imageUrl, imageBase64 } from "../lib/history/History";
const plantPath = path.join(__dirname, "data", "flower.jpg");

// ---------------------------------------------------------------------------
// 1. URL image via execute(MessageContent[])
// ---------------------------------------------------------------------------

async function exampleUrl() {
  const agent = new ClaudeAgent({
    id: "vision-url",
    name: "VisionAgent",
    description: "An agent that can analyse images",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: "claude-opus-4-6",
    maxTokens: 512,
  });

  const response = await agent.execute([
    imageUrl(
      "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png"
    ),
    { type: "text", text: "What do you see in this image? One sentence." },
  ]);

  console.log("[URL example]\n", response, "\n");
}
// ---------------------------------------------------------------------------
// 3. Multiple images — compare two images in one turn
// ---------------------------------------------------------------------------

async function exampleMultiImage() {
  const agent = new ClaudeAgent({
    id: "vision-multi",
    name: "VisionAgent",
    description: "An agent that can analyse images",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: "claude-opus-4-6",
    maxTokens: 512,
  });

  const response = await agent.execute([
    { type: "text", text: "Compare these two images in one sentence:" },
    imageUrl(
      "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png"
    ),
    imageUrl(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Gatto_europeo4.jpg/320px-Gatto_europeo4.jpg"
    ),
  ]);

  console.log("[Multi-image example]\n", response, "\n");
}

// ---------------------------------------------------------------------------
// 4. Plant identification — local JPEG via base64
//    Drop a photo at examples/data/plant.jpg to run this example.
// ---------------------------------------------------------------------------

async function examplePlantIdentification() {
  if (!fs.existsSync(plantPath)) {
    console.log(
      "[Plant example] skipped — add a photo at examples/data/plant.jpg\n"
    );
    return;
  }

  const agent = new ClaudeAgent({
    id: "vision-plant",
    name: "PlantAgent",
    description: "An agent that identifies plants from photos",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: "claude-opus-4-6",
    maxTokens: 512,
  });

  const data = fs.readFileSync(plantPath).toString("base64");

  const response = await agent.execute([
    imageBase64(data, "image/jpeg"),
    {
      type: "text",
      text: "What plant is this? Give the common name, scientific name, and one care tip.",
    },
  ]);

  console.log("[Plant example]\n", response, "\n");
}

// ---------------------------------------------------------------------------
// 5. OpenAI — same MessageContent[] interface works across providers
// ---------------------------------------------------------------------------

async function exampleOpenAi() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[OpenAI example] skipped — OPENAI_API_KEY not set\n");
    return;
  }

  const agent = new OpenAiAgent({
    id: "vision-openai",
    name: "VisionAgent",
    description: "An agent that can analyse images",
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
    maxTokens: 512,
  });

  const data = fs.readFileSync(plantPath).toString("base64");

  const response = await agent.execute([
    imageBase64(data, "image/jpeg"),
    {
      type: "text",
      text: "What plant is this? Give the common name, scientific name, and one care tip.",
    },
  ]);

  console.log("[OpenAI example]\n", response, "\n");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

(async () => {
  await exampleUrl();
  // await exampleMultiImage();
  await examplePlantIdentification();
  await exampleOpenAi();
})().catch(console.error);
