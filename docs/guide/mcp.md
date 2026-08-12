# MCP (Model Context Protocol)

[Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open standard developed by Anthropic for connecting AI agents to external tools, data sources, and services. Think of it as a universal adapter layer: instead of writing a custom integration for every API or service, you connect to an MCP server that already exposes that service's capabilities as tools. The agent then calls those tools just like any other — with no knowledge of the underlying transport.

## How It Works

MCP separates concerns cleanly into three parts:

- **MCP servers** — lightweight processes (local or remote) that expose a set of named tools. A server can wrap anything: a filesystem, a database, a REST API, a browser, a SaaS product.
- **MCP clients** — connect to servers, discover their tools, and call them on behalf of an agent. `MCPClient` is agention-lib's client implementation.
- **Tools** — once discovered, MCP tools become standard agention-lib `Tool` instances. The agent doesn't know or care whether a tool comes from MCP or custom code.

This means the entire [ecosystem of existing MCP servers](https://mcpservers.org) — filesystem, git, Slack, GitHub, databases, web search, and more — is immediately available to any agention-lib agent, without writing any integration code.

```
Agent  ──→  MCPClient  ──→  MCP Server  ──→  External Service
              (Tool[])        (stdio / HTTP)
```

## Installation

Install the MCP SDK alongside agention-lib:

```bash
npm install @modelcontextprotocol/sdk
```

## Quick Start

```typescript
import { MCPClient, ClaudeAgent } from '@agentionai/agents';

// 1. Connect to an MCP server
const mcp = MCPClient.fromStdio({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
});

await mcp.connect();

// 2. Pass its tools to any agent
const agent = new ClaudeAgent({
  id: 'file-agent',
  name: 'File Agent',
  description: 'An agent that can work with files.',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  tools: mcp.getTools(),
});

const result = await agent.execute('List the files in /tmp');

// 3. Clean up when done
await mcp.disconnect();
```

## Transport Types

### Stdio — Local Process

Use `MCPClient.fromStdio()` to spawn a local MCP server as a child process. Communication happens over stdin/stdout.

```typescript
const mcp = MCPClient.fromStdio({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user/docs'],
  env: { MY_VAR: 'value' }, // optional environment variables
});
```

This is the most common pattern for development and tools like filesystem, git, databases, etc.

### HTTP — Remote Server

Use `MCPClient.fromUrl()` to connect to a remote MCP server over [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

```typescript
const mcp = MCPClient.fromUrl('https://my-mcp-server.com/mcp');
```

## Authentication

### API Key / Bearer Token

Pass static auth headers for API-key protected servers:

```typescript
const mcp = MCPClient.fromUrl('https://my-mcp-server.com/mcp', {
  headers: {
    Authorization: `Bearer ${process.env.MCP_API_KEY}`,
  },
});
```

### OAuth 2.0

For servers that use OAuth, implement the `OAuthClientProvider` interface from the MCP SDK and pass it as `authProvider`:

```typescript
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';

// Your OAuth provider implementation
const myOAuthProvider: OAuthClientProvider = {
  // ... implement the interface
};

const mcp = MCPClient.fromUrl('https://my-mcp-server.com/mcp', {
  authProvider: myOAuthProvider,
});
```

## Lifecycle

`MCPClient` follows an explicit connect/disconnect lifecycle:

```typescript
const mcp = MCPClient.fromStdio({ command: 'node', args: ['server.js'] });

// Connect — discovers all tools from the server
await mcp.connect();

// Use tools with any agent
const tools = mcp.getTools();

// Disconnect — stops the process / closes the HTTP session
await mcp.disconnect();
```

Both `connect()` and `disconnect()` are **idempotent** — safe to call multiple times.

`getTools()` returns an empty array before `connect()` is called.

## Using Tools

`getTools()` returns standard `Tool` instances that work with all agent types:

```typescript
const tools = mcp.getTools();

// Pass at construction time
const agent = new ClaudeAgent({ ..., tools });

// Or add dynamically
agent.addTools(mcp.getTools());
```

Tools from multiple MCP servers can be combined freely:

```typescript
const fsMcp = MCPClient.fromStdio({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] });
const dbMcp = MCPClient.fromUrl('https://my-db-mcp.com/mcp');

await Promise.all([fsMcp.connect(), dbMcp.connect()]);

const agent = new ClaudeAgent({
  ...,
  tools: [...fsMcp.getTools(), ...dbMcp.getTools()],
});
```

## Cancellation and Timeouts

Every tool call is issued as an MCP request, which accepts an `AbortSignal` and a
timeout. Without them a hung server blocks an agent turn until the SDK's 60s
default expires, and the turn cannot be interrupted.

Set them per client with `callOptions`:

```typescript
const mcp = MCPClient.fromUrl('https://my-mcp-server.com/mcp', {
  callOptions: { timeout: 20_000 },
});
```

To cancel MCP calls along with the agent turn that made them, pass the signal to
`execute()` — it reaches the MCP call on its own, overriding any default
`signal` set here:

```typescript
const turn = new AbortController();

await agent.execute('Find me a place to stay', { signal: turn.signal });

// Aborting the turn rejects any in-flight MCP call immediately
turn.abort();
```

Pass a **function** to resolve the other options per call, e.g. by tool name:

```typescript
const mcp = MCPClient.fromUrl('https://my-mcp-server.com/mcp', {
  callOptions: ({ toolName }) => ({
    timeout: toolName === 'deep_research' ? 120_000 : 20_000,
  }),
});
```

`setCallOptions()` replaces the defaults later, and `mcp.callTool(name, input, options)`
takes per-call overrides that are layered over them.

| Option | Type | Description |
|--------|------|-------------|
| `signal` | `AbortSignal` | Cancels the in-flight call |
| `timeout` | `number` | Per-request timeout in ms (default: 60000) |
| `resetTimeoutOnProgress` | `boolean` | Restart the timeout on each progress notification |
| `maxTotalTimeout` | `number` | Hard ceiling regardless of progress |
| `onprogress` | `(progress) => void` | Progress notifications from the server |

## Tool Errors

MCP results carry an `isError` flag for failures inside the tool itself — a
missing file, a rejected query. By default `MCPClient` **throws** an `MCPToolError`
when it is set, so the failure is never handed to the model as if it had
succeeded. Agents catch tool errors and report them back to the model as a failed
tool result, so the model still sees the message and can react to it.

```typescript
import { MCPToolError } from '@agentionai/agents';

try {
  await tool.execute(agentId, agentName, input, callId);
} catch (error) {
  if (error instanceof MCPToolError) {
    console.warn(error.toolName, error.result); // raw CallToolResult
  }
}
```

Set `throwOnToolError: false` to receive the rendered error content as an
ordinary return value instead.

Transport-level failures — timeouts, aborts, protocol errors — throw
`MCPCallError` with the original error on `.cause`:

```typescript
if (error instanceof MCPCallError && (error.cause as Error)?.name === 'AbortError') {
  // the turn was cancelled
}
```

## Non-Text Content

MCP tools can return image, audio and resource blocks alongside text. Every block
is represented in the value the agent receives — text verbatim, binary content as
a placeholder naming its mime type and size, text resources inlined under their
URI:

```
Here is the chart:
[image content: image/png, 24.5 KB]
[resource: file:///tmp/notes.md, text/markdown]
# Notes
```

`structuredContent` is returned as an object when the result has no content
blocks, and appended as JSON when the result is binary-only, so structured output
is never lost.

To handle content yourself — for example turning image blocks into multimodal
message content — supply a `formatResult` function, or call
`mcp.callTool()` directly to get the raw `CallToolResult`:

```typescript
const mcp = MCPClient.fromUrl(url, {
  formatResult: (result, { toolName }) => renderForMyHost(toolName, result),
});

// or, out of band:
const raw = await mcp.callTool('screenshot', { url: 'https://example.com' });
raw.content; // full content blocks, unrendered
```

## Connection Loss and Reconnection

`MCPClient` is an `EventEmitter`. When a transport drops, the client reports it
instead of failing silently on every later call:

```typescript
import { MCPClient, MCPClientEvent } from '@agentionai/agents';

mcp.on(MCPClientEvent.DISCONNECTED, ({ deliberate, willReconnect }) => {
  if (!deliberate && !willReconnect) alertOps();
});
mcp.on(MCPClientEvent.RECONNECTING, ({ attempt, delayMs }) => log(attempt, delayMs));
mcp.on(MCPClientEvent.RECONNECTED, ({ tools }) => log(`back with ${tools.length} tools`));
mcp.on(MCPClientEvent.ERROR, (error) => log(error));
```

Enable automatic reconnection with exponential backoff:

```typescript
const mcp = MCPClient.fromUrl(url, {
  reconnect: { enabled: true, maxRetries: 10, initialDelayMs: 500, maxDelayMs: 30_000 },
});
```

A tool call made while a reconnect is in flight waits for it to finish rather
than failing outright. `mcp.getState()` reports `disconnected`, `connecting`,
`connected`, `reconnecting` or `failed`; `mcp.isConnected()` is the shorthand.

Tool instances survive a reconnect, so agents already holding them keep working.

## Tool List Changes

Servers that support it send `notifications/tools/list_changed` when they add or
remove tools. `MCPClient` subscribes automatically and re-runs discovery:

```typescript
mcp.on(MCPClientEvent.TOOLS_CHANGED, ({ tools, added, removed }) => {
  console.log('added', added, 'removed', removed);
  rebuildAgent(tools);
});
```

Tools whose definition is unchanged keep their identity across a refresh — only
new or modified tools become new `Tool` instances. Call `mcp.refreshTools()` to
re-discover on demand, or pass `refreshToolsOnListChanged: false` to opt out of
the automatic refresh.

## API Reference

### `MCPClient.fromStdio(config, options?)`

Creates a client that spawns a local process.

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.command` | `string` | Command to run (e.g. `"npx"`, `"node"`, `"python"`) |
| `config.args` | `string[]` | Arguments passed to the command |
| `config.env` | `Record<string, string>` | Environment variables for the process |
| `options` | `MCPClientOptions` | See [client options](#client-options) |

### `MCPClient.fromUrl(url, options?)`

Creates a client that connects over HTTP.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | Full URL to the MCP endpoint |
| `options.headers` | `Record<string, string>` | Static HTTP headers (e.g. `Authorization`) |
| `options.authProvider` | `OAuthClientProvider` | OAuth provider for dynamic authorization |
| `options` | `MCPClientOptions` | See [client options](#client-options) |

### Client options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `clientName` | `string` | `"agention-mcp-client"` | Client name sent during handshake |
| `clientVersion` | `string` | `"1.0.0"` | Client version |
| `callOptions` | `MCPToolCallOptions \| (context) => MCPToolCallOptions` | — | Default `signal` / `timeout` for every tool call |
| `throwOnToolError` | `boolean` | `true` | Throw `MCPToolError` when a result has `isError: true` |
| `formatResult` | `(result, context) => unknown` | — | Take over how results reach the agent |
| `reconnect` | `MCPReconnectOptions` | `{ enabled: false }` | Automatic reconnection with backoff |
| `refreshToolsOnListChanged` | `boolean` | `true` | Re-discover tools on `tools/list_changed` |

### `mcp.connect()`

Connects to the server and fetches all available tools. Idempotent; concurrent
calls share a single attempt.

### `mcp.getTools()`

Returns `Tool[]` — one instance per tool exposed by the MCP server. Returns `[]` before `connect()`.

### `mcp.callTool(name, input?, options?)`

Calls a tool directly and returns the raw `CallToolResult`, including non-text
content blocks and the `isError` flag. Does not render the result or throw on
`isError`.

### `mcp.refreshTools()`

Re-runs tool discovery and returns the refreshed list. Emits `toolsChanged` when
the list differs.

### `mcp.setCallOptions(options)`

Replaces the default call options after construction.

### `mcp.getState()` / `mcp.isConnected()`

Current connection state: `disconnected`, `connecting`, `connected`,
`reconnecting` or `failed`.

### `mcp.disconnect()`

Disconnects from the server, cancels any pending reconnect and clears the tool
list. Idempotent.

### Events

| Event | Payload | Emitted when |
|-------|---------|--------------|
| `connected` | `{ tools }` | `connect()` succeeds |
| `disconnected` | `{ error?, deliberate, willReconnect }` | The connection is lost or closed |
| `reconnecting` | `{ attempt, delayMs }` | Before each reconnect attempt |
| `reconnected` | `{ tools }` | A reconnect succeeds |
| `toolsChanged` | `{ tools, added, removed }` | The server's tool list changes |
| `error` | `Error` | Out-of-band transport or background errors |
