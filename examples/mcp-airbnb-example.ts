import "dotenv/config";

/**
 * MCP Airbnb Example
 *
 * Demonstrates using the Airbnb MCP server to search listings and retrieve
 * property details via an AI agent.
 *
 * The @openbnb/mcp-server-airbnb server exposes two tools:
 *   - airbnb_search      — search listings by location, dates, guests, price
 *   - airbnb_listing_details — get full details for a specific listing ID
 *
 * No API key required. Respects Airbnb's robots.txt by default.
 *
 * Prerequisites:
 *   npm install @modelcontextprotocol/sdk @anthropic-ai/sdk
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... ts-node examples/mcp-airbnb-example.ts
 */

import { MCPClient } from "../lib/mcp";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  // Spawn the Airbnb MCP server as a local process via npx
  const mcp = MCPClient.fromStdio({
    command: "npx",
    args: ["-y", "@openbnb/mcp-server-airbnb", "--ignore-robots-txt"],
  });

  console.log("Connecting to Airbnb MCP server...");
  await mcp.connect();

  const tools = mcp.getTools();
  console.log(
    `Discovered ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}\n`
  );

  const agent = new ClaudeAgent({
    id: "airbnb-agent",
    name: "Airbnb Agent",
    description:
      "You are a helpful travel assistant. Use the available tools to search Airbnb listings and provide detailed recommendations based on the user's needs.",
    apiKey,
    model: "claude-sonnet-4-6",
    maxTokens: 10000,
    tools,
  });

  const result = await agent.execute(
    "Find me a nice place to stay Near Weymouth for 2 adults " +
      "checking in on 2026-03-15 and checking out on 2026-03-20. " +
      "Give me the top 3 options with prices and a brief description of each."
  );

  console.log("Agent response:\n");
  console.log(result);

  await mcp.disconnect();
  console.log("\nDisconnected from Airbnb MCP server.");
}

main().catch(console.error);
