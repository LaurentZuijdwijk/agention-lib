// @ts-nocheck
import { MCPClient } from "./MCPClient";
import { Tool } from "../tools/Tool";

// Virtual mocks for @modelcontextprotocol/sdk — SDK does not need to be installed
const mockCallTool = jest.fn().mockResolvedValue({
  content: [{ type: "text", text: "Sunny, 22°C" }],
});

const mockListTools = jest.fn().mockResolvedValue({
  tools: [
    {
      name: "get_weather",
      description: "Fetches weather for a city",
      inputSchema: {
        type: "object",
        properties: { city: { type: "string", description: "City name" } },
        required: ["city"],
      },
    },
  ],
  nextCursor: undefined,
});

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockTerminateSession = jest.fn().mockResolvedValue(undefined);

const MockClient = jest.fn().mockImplementation(() => ({
  connect: mockConnect,
  close: mockClose,
  listTools: mockListTools,
  callTool: mockCallTool,
}));

const MockStdioTransport = jest.fn().mockImplementation(() => ({}));
const MockHttpTransport = jest.fn().mockImplementation(() => ({
  terminateSession: mockTerminateSession,
}));

jest.mock("@modelcontextprotocol/sdk/client/index.js", () => ({ Client: MockClient }), {
  virtual: true,
});
jest.mock(
  "@modelcontextprotocol/sdk/client/stdio.js",
  () => ({ StdioClientTransport: MockStdioTransport }),
  { virtual: true }
);
jest.mock(
  "@modelcontextprotocol/sdk/client/streamableHttp.js",
  () => ({ StreamableHTTPClientTransport: MockHttpTransport }),
  { virtual: true }
);

describe("MCPClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTools.mockResolvedValue({
      tools: [
        {
          name: "get_weather",
          description: "Fetches weather for a city",
          inputSchema: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
        },
      ],
      nextCursor: undefined,
    });
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "Sunny, 22°C" }],
    });
  });

  describe("fromStdio", () => {
    it("creates an MCPClient instance", () => {
      const client = MCPClient.fromStdio({ command: "node", args: ["server.js"] });
      expect(client).toBeInstanceOf(MCPClient);
    });

    it("accepts options", () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { clientName: "my-client", clientVersion: "2.0.0" }
      );
      expect(client).toBeInstanceOf(MCPClient);
    });
  });

  describe("fromUrl", () => {
    it("creates an MCPClient instance", () => {
      const client = MCPClient.fromUrl("http://localhost:3000/mcp");
      expect(client).toBeInstanceOf(MCPClient);
    });

    it("accepts headers and authProvider options", () => {
      const client = MCPClient.fromUrl("http://localhost:3000/mcp", {
        headers: { Authorization: "Bearer token" },
        authProvider: { getToken: jest.fn() },
      });
      expect(client).toBeInstanceOf(MCPClient);
    });
  });

  describe("getTools before connect", () => {
    it("returns empty array before connect is called", () => {
      const client = MCPClient.fromStdio({ command: "node" });
      expect(client.getTools()).toEqual([]);
    });
  });

  describe("connect + getTools (stdio)", () => {
    it("connects and returns Tool instances", async () => {
      const client = MCPClient.fromStdio({ command: "node", args: ["server.js"] });
      await client.connect();

      const tools = client.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBeInstanceOf(Tool);
      expect(tools[0].name).toBe("get_weather");
    });

    it("creates StdioClientTransport with correct args", async () => {
      const client = MCPClient.fromStdio({
        command: "npx",
        args: ["-y", "some-server"],
        env: { FOO: "bar" },
      });
      await client.connect();

      expect(MockStdioTransport).toHaveBeenCalledWith({
        command: "npx",
        args: ["-y", "some-server"],
        env: { FOO: "bar" },
      });
    });

    it("returns correct getPrompt() schema from wrapped tools", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const prompt = tool.getPrompt();

      expect(prompt.name).toBe("get_weather");
      expect(prompt.description).toBe("Fetches weather for a city");
      expect(prompt.input_schema).toEqual({
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      });
    });

    it("paginates listTools when nextCursor is present", async () => {
      mockListTools
        .mockResolvedValueOnce({
          tools: [{ name: "tool_a", description: "A", inputSchema: { type: "object", properties: {} } }],
          nextCursor: "cursor-1",
        })
        .mockResolvedValueOnce({
          tools: [{ name: "tool_b", description: "B", inputSchema: { type: "object", properties: {} } }],
          nextCursor: undefined,
        });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const tools = client.getTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("tool_a");
      expect(tools[1].name).toBe("tool_b");
      expect(mockListTools).toHaveBeenCalledTimes(2);
    });

    it("uses tool name as description when description is missing", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "no_desc_tool", inputSchema: { type: "object", properties: {} } }],
        nextCursor: undefined,
      });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      expect(tool.getPrompt().description).toBe("no_desc_tool");
    });
  });

  describe("connect + getTools (HTTP)", () => {
    it("creates StreamableHTTPClientTransport with correct URL", async () => {
      const client = MCPClient.fromUrl("http://localhost:3000/mcp");
      await client.connect();

      expect(MockHttpTransport).toHaveBeenCalledWith(
        new URL("http://localhost:3000/mcp"),
        {}
      );
    });

    it("passes headers via requestInit", async () => {
      const client = MCPClient.fromUrl("http://localhost:3000/mcp", {
        headers: { Authorization: "Bearer token123" },
      });
      await client.connect();

      expect(MockHttpTransport).toHaveBeenCalledWith(
        new URL("http://localhost:3000/mcp"),
        { requestInit: { headers: { Authorization: "Bearer token123" } } }
      );
    });

    it("passes authProvider to transport", async () => {
      const mockProvider = { getToken: jest.fn() };
      const client = MCPClient.fromUrl("http://localhost:3000/mcp", {
        authProvider: mockProvider,
      });
      await client.connect();

      expect(MockHttpTransport).toHaveBeenCalledWith(
        new URL("http://localhost:3000/mcp"),
        { authProvider: mockProvider }
      );
    });
  });

  describe("tool execute", () => {
    it("extracts text content from MCP result", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", { city: "Amsterdam" }, "call-1");
      expect(result).toBe("Sunny, 22°C");
    });

    it("joins multiple text items with newline", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [
          { type: "text", text: "Line 1" },
          { type: "text", text: "Line 2" },
        ],
      });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", { city: "Berlin" }, "call-2");
      expect(result).toBe("Line 1\nLine 2");
    });

    it("falls back to structuredContent when no text items", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "image", data: "..." }],
        structuredContent: { temperature: 22 },
      });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", { city: "Rome" }, "call-3");
      expect(result).toEqual({ temperature: 22 });
    });

    it("falls back to JSON.stringify when no text or structuredContent", async () => {
      mockCallTool.mockResolvedValueOnce({ content: [] });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", {}, "call-4");
      expect(result).toBe(JSON.stringify({ content: [] }));
    });

    it("wraps callTool errors with a descriptive message", async () => {
      mockCallTool.mockRejectedValueOnce(new Error("server error"));

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      await expect(
        tool.execute("agent-1", "TestAgent", { city: "Paris" }, "call-5")
      ).rejects.toThrow('MCPClient: Tool "get_weather" execution failed: server error');
    });

    it("throws if tool is executed after disconnect", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      await client.disconnect();

      await expect(
        tool.execute("agent-1", "TestAgent", { city: "Oslo" }, "call-6")
      ).rejects.toThrow("client is not connected");
    });
  });

  describe("disconnect", () => {
    it("clears tools after disconnect", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();
      expect(client.getTools()).toHaveLength(1);

      await client.disconnect();
      expect(client.getTools()).toHaveLength(0);
    });

    it("calls sdkClient.close() on disconnect", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();
      await client.disconnect();

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it("calls terminateSession on HTTP transport disconnect", async () => {
      const client = MCPClient.fromUrl("http://localhost:3000/mcp");
      await client.connect();
      await client.disconnect();

      expect(mockTerminateSession).toHaveBeenCalledTimes(1);
    });

    it("is idempotent — safe to call when not connected", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await expect(client.disconnect()).resolves.not.toThrow();
      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });

  describe("connect idempotency", () => {
    it("does not reconnect when already connected", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();
      await client.connect(); // second call should be no-op

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockListTools).toHaveBeenCalledTimes(1);
    });
  });
});
