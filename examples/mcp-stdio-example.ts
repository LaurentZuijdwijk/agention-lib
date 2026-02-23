import "dotenv/config";

/**
 * MCP Stdio Example
 *
 * Demonstrates connecting to a local MCP server process via stdio and using its
 * tools with a ClaudeAgent.
 *
 * This example uses the @modelcontextprotocol/server-filesystem MCP server, which
 * exposes filesystem operations (read_file, write_file, list_directory, etc.) as tools.
 *
 * Prerequisites:
 *   npm install @modelcontextprotocol/sdk @anthropic-ai/sdk
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... ts-node examples/mcp-stdio-example.ts
 */

import { MCPClient } from "../lib/mcp";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  // Connect to the filesystem MCP server via stdio (spawned as a child process)
  const mcp = MCPClient.fromStdio({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  });

  console.log("Connecting to MCP filesystem server...");
  await mcp.connect();

  const tools = mcp.getTools();
  console.log(
    `Discovered ${tools.length} MCP tools: ${tools
      .map((t) => t.name)
      .join(", ")}\n`
  );

  const agent = new ClaudeAgent({
    id: "mcp-file-agent",
    name: "File Agent",
    description:
      "An agent that can explore and read files using MCP filesystem tools.",
    apiKey,
    model: "claude-haiku-4-5-20251001",
    tools,
  });

  const result = await agent.execute(
    "List the contents of /tmp and describe what you find."
  );
  console.log("Agent response:\n", result);

  await mcp.disconnect();
  console.log("\nDisconnected from MCP server.");
}

main().catch(console.error);
