import "dotenv/config";
/**
 * MCP HTTP Example
 *
 * Demonstrates connecting to a remote MCP server via Streamable HTTP transport.
 * Shows both static API key auth (via headers) and the OAuth provider pattern.
 *
 * Prerequisites:
 *   npm install @modelcontextprotocol/sdk @anthropic-ai/sdk
 *
 * Usage:
 *   MCP_SERVER_URL=http://localhost:3000/mcp \
 *   MCP_API_KEY=my-key \
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *     ts-node examples/mcp-http-example.ts
 */

import { MCPClient } from "../lib/mcp";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mcpServerUrl =
    process.env.MCP_SERVER_URL ?? "http://localhost:3000/mcp";
  const mcpApiKey = process.env.MCP_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  // Connect to a remote MCP server with a static API key in the Authorization header.
  //
  // For OAuth-based servers, use the authProvider option instead:
  //
  //   import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
  //   const mcp = MCPClient.fromUrl(mcpServerUrl, { authProvider: myOAuthProvider });
  //
  const mcp = MCPClient.fromUrl(mcpServerUrl, {
    ...(mcpApiKey ? { headers: { Authorization: `Bearer ${mcpApiKey}` } } : {}),
  });

  console.log(`Connecting to MCP server at ${mcpServerUrl}...`);
  await mcp.connect();

  const tools = mcp.getTools();
  console.log(
    `Discovered ${tools.length} MCP tools: ${tools
      .map((t) => t.name)
      .join(", ")}\n`
  );

  const agent = new ClaudeAgent({
    id: "mcp-http-agent",
    name: "Remote MCP Agent",
    description: "An agent that uses tools from a remote MCP server.",
    apiKey,
    model: "claude-haiku-4-5-20251001",
    tools,
  });

  const result = await agent.execute(
    "What tools do you have available? Briefly describe each one."
  );
  console.log("Agent response:\n", result);

  await mcp.disconnect();
  console.log("\nDisconnected from MCP server.");
}

main().catch(console.error);
