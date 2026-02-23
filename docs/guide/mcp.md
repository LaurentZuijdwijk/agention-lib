# MCP (Model Context Protocol)

[Model Context Protocol](https://modelcontextprotocol.io) is an open standard for connecting AI agents to external tools and data sources. Any MCP-compatible server — whether local or remote — can be connected to agention-lib agents in a few lines.

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

## API Reference

### `MCPClient.fromStdio(config, options?)`

Creates a client that spawns a local process.

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.command` | `string` | Command to run (e.g. `"npx"`, `"node"`, `"python"`) |
| `config.args` | `string[]` | Arguments passed to the command |
| `config.env` | `Record<string, string>` | Environment variables for the process |
| `options.clientName` | `string` | Client name sent during handshake (default: `"agention-mcp-client"`) |
| `options.clientVersion` | `string` | Client version (default: `"1.0.0"`) |

### `MCPClient.fromUrl(url, options?)`

Creates a client that connects over HTTP.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | Full URL to the MCP endpoint |
| `options.headers` | `Record<string, string>` | Static HTTP headers (e.g. `Authorization`) |
| `options.authProvider` | `OAuthClientProvider` | OAuth provider for dynamic authorization |
| `options.clientName` | `string` | Client name sent during handshake |
| `options.clientVersion` | `string` | Client version |

### `mcp.connect()`

Connects to the server and fetches all available tools. Idempotent.

### `mcp.getTools()`

Returns `Tool[]` — one instance per tool exposed by the MCP server. Returns `[]` before `connect()`.

### `mcp.disconnect()`

Disconnects from the server and clears the tool list. Idempotent.
