// @ts-nocheck
import { MCPClient, MCPClientEvent } from "./MCPClient";
import { MCPCallError, MCPNotConnectedError, MCPToolError } from "./errors";
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

const TOOL_LIST_CHANGED_SCHEMA = { method: "notifications/tools/list_changed" };

/** Every SDK client the code under test constructed, oldest first. */
const clientInstances = [];

const MockClient = jest.fn().mockImplementation(() => {
  const instance = {
    connect: mockConnect,
    close: mockClose,
    listTools: mockListTools,
    callTool: mockCallTool,
    notificationHandlers: new Map(),
    setNotificationHandler: jest.fn((schema, handler) => {
      instance.notificationHandlers.set(schema, handler);
    }),
  };
  clientInstances.push(instance);
  return instance;
});

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
jest.mock(
  "@modelcontextprotocol/sdk/types.js",
  () => ({ ToolListChangedNotificationSchema: TOOL_LIST_CHANGED_SCHEMA }),
  { virtual: true }
);

/** The most recently constructed SDK client. */
const currentSdkClient = () => clientInstances[clientInstances.length - 1];

/** Simulate the transport dropping underneath the client. */
const dropConnection = () => currentSdkClient().onclose?.();

/** Simulate the server announcing a changed tool list. */
const announceToolListChanged = () =>
  currentSdkClient().notificationHandlers.get(TOOL_LIST_CHANGED_SCHEMA)?.();

/** Resolve once `event` fires, or reject if it takes too long. */
const nextEvent = (client, event, timeoutMs = 1000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs
    );
    client.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const weatherTools = (overrides = {}) => ({
  tools: [
    {
      name: "get_weather",
      description: "Fetches weather for a city",
      inputSchema: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
      ...overrides,
    },
  ],
  nextCursor: undefined,
});

describe("MCPClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clientInstances.length = 0;
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue(weatherTools());
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

    it("reports the disconnected state", () => {
      const client = MCPClient.fromStdio({ command: "node" });
      expect(client.getState()).toBe("disconnected");
      expect(client.isConnected()).toBe(false);
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
      expect(client.isConnected()).toBe(true);
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

    it("emits connected with the discovered tools", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      const connected = nextEvent(client, MCPClientEvent.CONNECTED);
      await client.connect();

      const payload = await connected;
      expect(payload.tools).toHaveLength(1);
      expect(payload.tools[0].name).toBe("get_weather");
    });

    it("restores the disconnected state when connecting fails", async () => {
      mockConnect.mockRejectedValueOnce(new Error("spawn failed"));

      const client = MCPClient.fromStdio({ command: "node" });
      await expect(client.connect()).rejects.toThrow("spawn failed");
      expect(client.getState()).toBe("disconnected");
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

    it("falls back to structuredContent when there are no content blocks", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [],
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

    it("keeps the underlying error as the cause of a wrapped failure", async () => {
      const underlying = new Error("server error");
      mockCallTool.mockRejectedValueOnce(underlying);

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const error = await tool
        .execute("agent-1", "TestAgent", { city: "Paris" }, "call-5b")
        .catch((e) => e);

      expect(error).toBeInstanceOf(MCPCallError);
      expect(error.toolName).toBe("get_weather");
      expect(error.cause).toBe(underlying);
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

  describe("non-text content", () => {
    it("represents image blocks instead of dropping them", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [
          { type: "text", text: "Here is the map:" },
          { type: "image", data: "AAAA", mimeType: "image/png" },
        ],
      });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", {}, "call-7");
      expect(result).toBe("Here is the map:\n[image content: image/png, 3 B]");
    });

    it("inlines embedded text resources", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "resource",
            resource: { uri: "file:///tmp/a.txt", mimeType: "text/plain", text: "hello" },
          },
        ],
      });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", {}, "call-8");
      expect(result).toBe("[resource: file:///tmp/a.txt, text/plain]\nhello");
    });

    it("keeps structuredContent alongside a binary-only result", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
        structuredContent: { width: 64 },
      });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", {}, "call-9");
      expect(result).toBe('[image content: image/png, 3 B]\n{"width":64}');
    });

    it("hands the raw result to a formatResult override", async () => {
      const raw = {
        content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
      };
      mockCallTool.mockResolvedValueOnce(raw);

      const formatResult = jest.fn(() => ({ handled: true }));
      const client = MCPClient.fromStdio({ command: "node" }, { formatResult });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", { city: "Lima" }, "call-10");

      expect(result).toEqual({ handled: true });
      expect(formatResult).toHaveBeenCalledWith(raw, {
        toolName: "get_weather",
        input: { city: "Lima" },
      });
    });

    it("exposes the raw result including content blocks via callTool", async () => {
      const raw = {
        content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
        isError: true,
      };
      mockCallTool.mockResolvedValueOnce(raw);

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      // The escape hatch neither renders nor throws on isError
      await expect(client.callTool("get_weather", { city: "Quito" })).resolves.toBe(raw);
    });
  });

  describe("isError results", () => {
    it("throws MCPToolError so the agent reports a failed tool call", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: "City not found" }],
        isError: true,
      });

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const error = await tool
        .execute("agent-1", "TestAgent", { city: "Atlantis" }, "call-11")
        .catch((e) => e);

      expect(error).toBeInstanceOf(MCPToolError);
      expect(error.message).toBe(
        'MCPClient: Tool "get_weather" reported an error: City not found'
      );
      expect(error.toolName).toBe("get_weather");
      expect(error.result.isError).toBe(true);
    });

    it("returns the rendered error content when throwOnToolError is false", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: "City not found" }],
        isError: true,
      });

      const client = MCPClient.fromStdio({ command: "node" }, { throwOnToolError: false });
      await client.connect();

      const [tool] = client.getTools();
      const result = await tool.execute("agent-1", "TestAgent", { city: "Atlantis" }, "call-12");
      expect(result).toBe("City not found");
    });

    it("treats a result without isError as a success", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      await expect(
        tool.execute("agent-1", "TestAgent", { city: "Oslo" }, "call-13")
      ).resolves.toBe("Sunny, 22°C");
    });
  });

  describe("call options", () => {
    it("calls the SDK without request options when none are configured", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      await tool.execute("agent-1", "TestAgent", { city: "Oslo" }, "call-14");

      expect(mockCallTool).toHaveBeenCalledWith({
        name: "get_weather",
        arguments: { city: "Oslo" },
      });
    });

    it("forwards a client-level timeout to every call", async () => {
      const client = MCPClient.fromStdio({ command: "node" }, { callOptions: { timeout: 5000 } });
      await client.connect();

      const [tool] = client.getTools();
      await tool.execute("agent-1", "TestAgent", { city: "Oslo" }, "call-15");

      expect(mockCallTool).toHaveBeenCalledWith(
        { name: "get_weather", arguments: { city: "Oslo" } },
        undefined,
        { timeout: 5000 }
      );
    });

    it("resolves function call options per call with the tool context", async () => {
      const controller = new AbortController();
      const callOptions = jest.fn(() => ({ signal: controller.signal, timeout: 1234 }));

      const client = MCPClient.fromStdio({ command: "node" }, { callOptions });
      await client.connect();

      const [tool] = client.getTools();
      await tool.execute("agent-1", "TestAgent", { city: "Oslo" }, "call-16");

      expect(callOptions).toHaveBeenCalledWith({
        toolName: "get_weather",
        input: { city: "Oslo" },
      });
      expect(mockCallTool).toHaveBeenCalledWith(
        { name: "get_weather", arguments: { city: "Oslo" } },
        undefined,
        { signal: controller.signal, timeout: 1234 }
      );
    });

    it("layers per-call options over the client defaults", async () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { callOptions: { timeout: 5000, maxTotalTimeout: 60000 } }
      );
      await client.connect();

      await client.callTool("get_weather", { city: "Oslo" }, { timeout: 100 });

      expect(mockCallTool).toHaveBeenCalledWith(
        { name: "get_weather", arguments: { city: "Oslo" } },
        undefined,
        { timeout: 100, maxTotalTimeout: 60000 }
      );
    });

    it("replaces the defaults via setCallOptions", async () => {
      const client = MCPClient.fromStdio({ command: "node" }, { callOptions: { timeout: 5000 } });
      await client.connect();
      client.setCallOptions({ timeout: 250 });

      const [tool] = client.getTools();
      await tool.execute("agent-1", "TestAgent", { city: "Oslo" }, "call-17");

      expect(mockCallTool).toHaveBeenCalledWith(
        { name: "get_weather", arguments: { city: "Oslo" } },
        undefined,
        { timeout: 250 }
      );
    });

    it("rejects without reaching the server when the signal is already aborted", async () => {
      const controller = new AbortController();
      const client = MCPClient.fromStdio(
        { command: "node" },
        { callOptions: () => ({ signal: controller.signal }) }
      );
      await client.connect();
      controller.abort();

      const [tool] = client.getTools();
      await expect(
        tool.execute("agent-1", "TestAgent", { city: "Oslo" }, "call-18")
      ).rejects.toThrow('MCPClient: Tool "get_weather" execution failed: request was aborted');

      expect(mockCallTool).not.toHaveBeenCalled();
    });

    it("propagates an abort raised by the SDK mid-call", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockCallTool.mockRejectedValueOnce(abortError);

      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      const error = await tool
        .execute("agent-1", "TestAgent", { city: "Oslo" }, "call-19")
        .catch((e) => e);

      expect(error).toBeInstanceOf(MCPCallError);
      expect(error.cause.name).toBe("AbortError");
    });
  });

  describe("connection drops", () => {
    it("emits disconnected and moves to failed when reconnection is off", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const disconnected = nextEvent(client, MCPClientEvent.DISCONNECTED);
      dropConnection();

      await expect(disconnected).resolves.toEqual({
        deliberate: false,
        willReconnect: false,
      });
      expect(client.getState()).toBe("failed");
      expect(client.isConnected()).toBe(false);
    });

    it("reports the transport error that caused the drop", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      client.on(MCPClientEvent.ERROR, () => undefined);
      await client.connect();

      const disconnected = nextEvent(client, MCPClientEvent.DISCONNECTED);
      const transportError = new Error("socket hang up");
      currentSdkClient().onerror?.(transportError);
      dropConnection();

      expect((await disconnected).error).toBe(transportError);
    });

    it("reports the connection state on the error thrown after a drop", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const [tool] = client.getTools();
      dropConnection();

      const error = await tool
        .execute("agent-1", "TestAgent", { city: "Oslo" }, "call-20")
        .catch((e) => e);

      expect(error).toBeInstanceOf(MCPNotConnectedError);
      expect(error.state).toBe("failed");
      expect(error.toolName).toBe("get_weather");
    });

    it("keeps the tool list after a drop so agents keep their references", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();
      const [tool] = client.getTools();

      dropConnection();

      expect(client.getTools()).toHaveLength(1);
      expect(client.getTools()[0]).toBe(tool);
    });

    it("reconnects with backoff when reconnection is enabled", async () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { reconnect: { enabled: true, initialDelayMs: 1, maxDelayMs: 1 } }
      );
      await client.connect();

      const reconnecting = nextEvent(client, MCPClientEvent.RECONNECTING);
      const reconnected = nextEvent(client, MCPClientEvent.RECONNECTED);

      dropConnection();

      expect((await reconnecting).attempt).toBe(1);
      await reconnected;

      expect(client.getState()).toBe("connected");
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it("announces the pending reconnect in the disconnected event", async () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { reconnect: { enabled: true, initialDelayMs: 1, maxDelayMs: 1 } }
      );
      await client.connect();

      const disconnected = nextEvent(client, MCPClientEvent.DISCONNECTED);
      dropConnection();

      expect(await disconnected).toEqual({ deliberate: false, willReconnect: true });
      await nextEvent(client, MCPClientEvent.RECONNECTED);
      await client.disconnect();
    });

    it("lets a tool call ride out an in-flight reconnect", async () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { reconnect: { enabled: true, initialDelayMs: 5, maxDelayMs: 5 } }
      );
      await client.connect();

      const [tool] = client.getTools();
      dropConnection();

      await expect(
        tool.execute("agent-1", "TestAgent", { city: "Oslo" }, "call-21")
      ).resolves.toBe("Sunny, 22°C");
      expect(client.getState()).toBe("connected");
    });

    it("gives up after maxRetries and stays failed", async () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { reconnect: { enabled: true, maxRetries: 2, initialDelayMs: 1, maxDelayMs: 1 } }
      );
      await client.connect();

      const errors = [];
      client.on(MCPClientEvent.ERROR, (error) => errors.push(error));

      mockConnect.mockRejectedValue(new Error("still down"));
      const attempts = [];
      client.on(MCPClientEvent.RECONNECTING, ({ attempt }) => attempts.push(attempt));

      dropConnection();
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(attempts).toEqual([1, 2]);
      expect(errors).toHaveLength(2);
      expect(client.getState()).toBe("failed");
    });

    it("cancels a pending reconnect when disconnect is called", async () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { reconnect: { enabled: true, initialDelayMs: 50, maxDelayMs: 50 } }
      );
      await client.connect();

      dropConnection();
      expect(client.getState()).toBe("reconnecting");

      await client.disconnect();

      expect(client.getState()).toBe("disconnected");
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("does not treat a deliberate disconnect as a drop", async () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { reconnect: { enabled: true, initialDelayMs: 1 } }
      );
      await client.connect();

      const events = [];
      client.on(MCPClientEvent.DISCONNECTED, (payload) => events.push(payload));

      await client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(events).toEqual([{ deliberate: true, willReconnect: false }]);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("can be connected again after a failed connection", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();
      dropConnection();
      expect(client.getState()).toBe("failed");

      await client.connect();
      expect(client.getState()).toBe("connected");
      expect(client.getTools()).toHaveLength(1);
    });
  });

  describe("tools/list_changed", () => {
    it("subscribes to the tool list changed notification", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      expect(currentSdkClient().setNotificationHandler).toHaveBeenCalledWith(
        TOOL_LIST_CHANGED_SCHEMA,
        expect.any(Function)
      );
    });

    it("does not subscribe when refreshToolsOnListChanged is disabled", async () => {
      const client = MCPClient.fromStdio(
        { command: "node" },
        { refreshToolsOnListChanged: false }
      );
      await client.connect();

      expect(currentSdkClient().setNotificationHandler).not.toHaveBeenCalled();
    });

    it("re-discovers tools and reports what changed", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      mockListTools.mockResolvedValueOnce({
        tools: [
          {
            name: "get_forecast",
            description: "Fetches a forecast",
            inputSchema: { type: "object", properties: {} },
          },
        ],
        nextCursor: undefined,
      });

      const changed = nextEvent(client, MCPClientEvent.TOOLS_CHANGED);
      announceToolListChanged();

      const payload = await changed;
      expect(payload.added).toEqual(["get_forecast"]);
      expect(payload.removed).toEqual(["get_weather"]);
      expect(client.getTools().map((tool) => tool.name)).toEqual(["get_forecast"]);
    });

    it("keeps Tool identity for definitions that did not change", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();
      const [before] = client.getTools();

      mockListTools.mockResolvedValueOnce({
        tools: [
          weatherTools().tools[0],
          {
            name: "get_forecast",
            description: "Fetches a forecast",
            inputSchema: { type: "object", properties: {} },
          },
        ],
        nextCursor: undefined,
      });

      const changed = nextEvent(client, MCPClientEvent.TOOLS_CHANGED);
      announceToolListChanged();
      await changed;

      expect(client.getTools()[0]).toBe(before);
      expect(client.getTools()[1].name).toBe("get_forecast");
    });

    it("replaces a Tool whose schema changed", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();
      const [before] = client.getTools();

      mockListTools.mockResolvedValueOnce(
        weatherTools({
          inputSchema: {
            type: "object",
            properties: { city: { type: "string" }, units: { type: "string" } },
            required: ["city"],
          },
        })
      );

      const changed = nextEvent(client, MCPClientEvent.TOOLS_CHANGED);
      announceToolListChanged();
      await changed;

      const [after] = client.getTools();
      expect(after).not.toBe(before);
      expect(after.getPrompt().input_schema.properties).toHaveProperty("units");
    });

    it("stays quiet when the tool list is unchanged", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const listener = jest.fn();
      client.on(MCPClientEvent.TOOLS_CHANGED, listener);

      await client.refreshTools();

      expect(listener).not.toHaveBeenCalled();
    });

    it("surfaces a failed refresh as an error event instead of throwing", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await client.connect();

      const error = nextEvent(client, MCPClientEvent.ERROR);
      mockListTools.mockRejectedValueOnce(new Error("list failed"));
      announceToolListChanged();

      expect((await error).message).toBe("list failed");
    });

    it("refreshTools throws when the client is not connected", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await expect(client.refreshTools()).rejects.toThrow(MCPNotConnectedError);
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

    it("shares a single attempt between concurrent connect calls", async () => {
      const client = MCPClient.fromStdio({ command: "node" });
      await Promise.all([client.connect(), client.connect()]);

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });
});
