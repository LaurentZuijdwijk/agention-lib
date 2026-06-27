# History Management

Agention provides a powerful, provider-agnostic history system that enables conversation persistence, sharing between agents of different providers, and easy extensibility to custom storage backends.

## Overview

The history system normalizes conversation data into a shared format that can be:
- Transformed to any LLM provider's native format (Anthropic, OpenAI, Mistral, Gemini)
- Shared between agents using different providers
- Persisted to various storage backends (memory, Redis, custom)
- Extended with plugins for context management and token budgeting

For the full context management guide — tool result masking, rolling summarization, and sub-agent delegation — see [Context Management](/guide/context-management). A runnable example is at [`examples/history-compression-example.ts`](https://github.com/laurentzuijdwijk/agention-lib/blob/master/examples/history-compression-example.ts).

## Basic Usage

### In-Memory History

```typescript
import { History } from '@agentionai/agents/history';

const history = new History();

// Add text messages
history.addText('user', 'Hello!');
history.addText('assistant', 'Hi there!');

// Get all entries (with any transform plugins applied)
const entries = history.getEntries();

// Clear history
history.clear();
```

### Sharing History Between Agents

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';
import { History } from '@agentionai/agents/history';

// Create a shared history
const sharedHistory = new History();

// Both agents use the same conversation history
const claudeAgent = new ClaudeAgent(
  {
    id: 'claude-agent',
    name: 'Claude Agent',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
  },
  sharedHistory
);

const openAiAgent = new OpenAiAgent(
  {
    id: 'openai-agent',
    name: 'OpenAI Agent',
    description: 'A helpful assistant.',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o',
  },
  sharedHistory
);

// Conversation is preserved across different providers
await claudeAgent.execute('My name is Alice.');
const response = await openAiAgent.execute('What is my name?');
// OpenAI agent can access Claude's conversation: "Your name is Alice"
```

## Provider-Agnostic Format

All conversation data is stored in a normalized format:

```typescript
type HistoryEntry = {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent[];
  meta?: ProviderMeta;  // Optional provider-specific metadata
};

type MessageContent =
  | TextContent
  | ToolUseContent
  | ToolResultContent;
```

### Content Types

```typescript
// Plain text
const textContent = { type: 'text', text: 'Hello' };

// Tool/function call
const toolUse = {
  type: 'tool_use',
  id: 'call_123',
  name: 'get_weather',
  input: { city: 'Paris' }
};

// Tool result
const toolResult = {
  type: 'tool_result',
  tool_use_id: 'call_123',
  content: '22°C, sunny'
};
```

### Helper Functions

```typescript
import { text, toolUse, toolResult, textMessage } from '@agentionai/agents/history';

// Create content blocks
history.addEntry({
  role: 'user',
  content: [text('What is the weather in Paris?')]
});

history.addEntry({
  role: 'assistant',
  content: [
    text('I\'ll check that for you.'),
    toolUse('call_123', 'get_weather', { city: 'Paris' })
  ]
});

history.addEntry({
  role: 'user',
  content: [toolResult('call_123', '22°C, sunny')]
});

// Or use the convenience method for simple messages
history.addText('user', 'Thank you!');
```

## History Methods

### Adding Messages

```typescript
// Add a simple text message
history.addText('user', 'Hello');

// Add a message with multiple content blocks
history.addMessage('assistant', [
  text('I\'ll help you with that.'),
  toolUse('call_123', 'search', { query: 'weather' })
]);

// Add a system message
history.addSystem('You are a helpful assistant.');

// Add a complete entry
history.addEntry({
  role: 'user',
  content: [text('Hello')]
});
```

### Retrieving Messages

```typescript
// Get entries as agents see them — transform plugins applied
const entries = history.getEntries();

// Get raw stored entries — no plugins applied, used for serialization
const raw = history.entries;

// Get the full content of a tool result by its tool_use_id
// Always reads raw storage regardless of masking plugins
const result = history.getToolResult('call_123');

// Get number of entries
const count = history.length;

// Get total estimated token count
const tokens = history.totalEstimatedTokens;

// Get total content size in characters
const size = history.size;

// Get the last entry
const last = history.lastEntry();

// Get system message
const systemMsg = history.getSystemMessage();

// Get all messages without system messages (transform plugins applied)
const messages = history.getMessagesWithoutSystem();
```

### Serialization

```typescript
// Serialize to JSON
const json = history.toJSON();

// Load from JSON
const restored = History.fromJSON(json);

// Clone history
const copy = history.clone();
```

## Persistent History with Redis

For production applications, persist history to Redis:

```typescript
import { RedisHistory } from '@agentionai/agents/history';
import Redis from 'ioredis';

// Create Redis client
const redis = new Redis({
  host: 'localhost',
  port: 6379
});

// Create RedisHistory instance
const history = new RedisHistory(redis);

// Load existing conversation
await history.load('conversation:user123');

// Use with agent
const agent = new ClaudeAgent(
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
  },
  history
);

await agent.execute('Hello!');

// Save back to Redis
await history.save('conversation:user123');
```

### Auto-save Pattern

```typescript
const history = new RedisHistory(redis);
const conversationKey = 'conversation:user123';

// Load existing history
await history.load(conversationKey);

// Auto-save after each interaction
history.on('entry', async () => {
  await history.save(conversationKey);
});

const agent = new ClaudeAgent(
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
  },
  history
);
await agent.execute('Hello!'); // Automatically saved
```

## Custom Storage Backends

The history system is easily extended to support any storage mechanism. Simply extend the `History` class:

```typescript
import { History } from '@agentionai/agents/history';

class DatabaseHistory extends History {
  constructor(private db: DatabaseClient) {
    super([], { transient: false });
  }

  async load(conversationId: string): Promise<void> {
    const rows = await this.db.query(
      'SELECT data FROM conversations WHERE id = ?',
      [conversationId]
    );

    if (rows.length > 0) {
      const entries = JSON.parse(rows[0].data);
      this._entries = entries;
    }
  }

  async save(conversationId: string): Promise<void> {
    const serialized = this.toJSON();

    await this.db.query(
      'INSERT INTO conversations (id, data) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET data = ?',
      [conversationId, serialized, serialized]
    );
  }
}
```

### Example: File-Based History

```typescript
import { History } from '@agentionai/agents/history';
import { promises as fs } from 'fs';
import path from 'path';

class FileHistory extends History {
  constructor(private baseDir: string) {
    super([], { transient: false });
  }

  async load(conversationId: string): Promise<void> {
    const filePath = path.join(this.baseDir, `${conversationId}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const entries = JSON.parse(data);
      this._entries = entries;
    } catch (error) {
      // File doesn't exist yet, start fresh
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async save(conversationId: string): Promise<void> {
    const filePath = path.join(this.baseDir, `${conversationId}.json`);
    await fs.writeFile(filePath, this.toJSON(), 'utf-8');
  }
}

// Usage
const history = new FileHistory('./conversations');
await history.load('user123');

const agent = new ClaudeAgent(
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
  },
  history
);
await agent.execute('Hello!');

await history.save('user123');
```

## Events

History emits events that you can listen to:

```typescript
history.on('entry', (entry: HistoryEntry) => {
  console.log('New entry added:', entry);
});

history.on('clear', () => {
  console.log('History cleared');
});

// Fired when a plugin's afterAdd hook throws
history.on('pluginError', (error: Error, plugin: HistoryPlugin, hook: string) => {
  console.error(`Plugin error in ${hook}:`, error.message);
});
```

## Plugin System

Plugins extend history with additional behaviour without requiring subclasses. Any `History` or `RedisHistory` instance can accept plugins, so storage backends and context strategies compose freely.

```typescript
import { HistoryPlugin } from '@agentionai/agents/history';

type HistoryPlugin = {
  onRegistered?: (history: History) => void;
  afterAdd?:     (history: History) => void | Promise<void>;
  reduce?:       (entries: ReducibleEntry[], options: ReduceOptions) => Promise<ReducibleEntry[]>;
  transform?:    (entries: ReducibleEntry[]) => ReducibleEntry[];
};
```

| Hook | When it runs | Sync/async | Typical use |
|---|---|---|---|
| `onRegistered` | Once, immediately on `history.use(plugin)` | sync | Capture history reference |
| `afterAdd` | After every `addEntry()`, fire-and-forget | async | Trigger deferred work |
| `reduce` | When `history.reduce(options)` is called | async | Compress old entries via LLM |
| `transform` | Every time `history.getEntries()` is called | sync | Read-time rewrite (e.g. masking) |

### Registering Plugins

```typescript
import { compressionPlugin, toolResultMaskingPlugin } from '@agentionai/agents/history/plugins';

const maskingPlugin = toolResultMaskingPlugin({ keepRecentResults: 2 });

const history = new History([], { maxTokens: 20000 })
  .use(maskingPlugin)              // register first
  .use(compressionPlugin(agent));  // register second — plugins run in order
```

Plugins are applied in registration order for both `transform` and `reduce`. `use()` is chainable and calls `onRegistered` immediately.

### Error Handling

Errors thrown by `afterAdd` hooks are fire-and-forget and will not crash the caller. Configure an error handler:

```typescript
// Option A: callback in constructor options
const history = new History([], {
  onPluginError: (error, plugin, hook) => {
    logger.error({ error, hook }, 'History plugin error');
  }
});

// Option B: event listener (default when no callback is set)
history.on('pluginError', (error, plugin, hook) => {
  console.error(`[${hook}]`, error.message);
});
```

---

## Built-in Plugins

### Tool Result Masking

Large tool results — web search dumps, file reads — rapidly consume context tokens, but the agent only really needs them when they are fresh. `toolResultMaskingPlugin` keeps the most recent N results verbatim and replaces older ones with a lightweight reference marker at read time. The full content is always stored; nothing is lost.

```typescript
import { toolResultMaskingPlugin } from '@agentionai/agents/history/plugins';

const maskingPlugin = toolResultMaskingPlugin({
  keepRecentResults: 2,        // keep last 2 verbatim, mask everything older
  exclude: ['calculator'],     // these tools are never masked
  minTokensToMask: 50,         // don't bother masking tiny results
});

const history = new History().use(maskingPlugin);

// Wire the retrieve tool so the agent can fetch masked results on demand
const agent = new ClaudeAgent(
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
    tools: [maskingPlugin.retrieveTool, ...otherTools],
  },
  history
);
```

When the agent needs an old result it calls `retrieve_tool_result(tool_call_id)` and gets the full content back from history storage.

#### Options

| Option | Default | Description |
|---|---|---|
| `keepRecentResults` | `2` | Number of most-recent maskable results kept verbatim |
| `exclude` | — | Tool names never masked. Mutually exclusive with `include`. |
| `include` | — | Only mask these tool names. Mutually exclusive with `exclude`. |
| `minTokensToMask` | — | Skip masking if the result is smaller than this (estimated tokens) |

`exclude` and `include` are mutually exclusive — providing both throws at construction. Excluded or too-small results do not consume a `keepRecentResults` slot.

#### How masking works

The plugin's `transform` hook runs every time `history.getEntries()` is called. It is:
- **Lossless** — stored entries are never mutated
- **Free** — no LLM, no async, just a string replacement
- **Transparent** — `history.getToolResult(id)` and `maskingPlugin.retrieveTool` always return the original content
- **Cache-breaking** — masking mutates the prompt content the LLM sees. On providers with prompt caching (e.g. Anthropic), a newly-masked result changes the prefix and prevents a cache hit on the next API call. You trade token savings for potentially losing caching savings on multi-turn conversations.

```
[turn 1] tool_use: web_search(query="...")
[turn 1] tool_result: [MASKED - ref: tu_001]   ← old, replaced in view
[turn 2] tool_use: web_search(query="...")
[turn 2] tool_result: "...full 8000 tokens..."  ← recent, kept verbatim
```

---

### Rolling Conversation Summary

`compressionPlugin` compresses old conversation turns into a concise summary entry using an LLM. The summary is a rolling one: if a previous summary exists, it is included as prior context and merged into the new summary, so at most one summary entry exists at any time.

```typescript
import { compressionPlugin } from '@agentionai/agents/history/plugins';

// A dedicated, cheap summarization agent
const summaryAgent = new ClaudeAgent({
  id: 'summarizer',
  name: 'Summarizer',
  description: 'Summarizes conversation history',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-haiku-4-5-20251001',
});

const history = new History().use(compressionPlugin(summaryAgent));

// Compress all entries that push the history over 4000 tokens
await history.reduce({ maxTokens: 4000 });
```

`reduce()` is a no-op if no `reduce`-capable plugin is registered, so it is safe to call unconditionally at the end of each agent turn.

#### Auto-reduce

Pass `autoReduceWhen` to trigger compression automatically after every `addEntry()` call — no manual `history.reduce()` required:

```typescript
const history = new History([], { maxTokens: 20000 })
  .use(compressionPlugin(summaryAgent, {
    autoReduceWhen: { maxTokens: 6000 },
  }));

// Compression fires automatically whenever history exceeds 6 000 tokens
await agent.execute('Tell me about the history of the internet.');
await agent.execute('And artificial intelligence?');
// ...
```

The `afterAdd` hook checks the threshold synchronously; the `reduce()` call itself is async and fire-and-forget. The re-entrancy guard in `History` ensures that adding the summary entry during compression does not trigger another reduction.

#### Reduce options

```typescript
type ReduceOptions = {
  maxTokens?: number;   // compress until total tokens fall below this
  maxEntries?: number;  // compress until entry count falls below this
  olderThan?: Date;     // compress entries before this timestamp
};
```

All three fields work for both `autoReduceWhen` and manual `history.reduce()` calls. The system prompt is always preserved. The summary entry uses `role: "user"` (no provider has a dedicated summary role) and is always prefixed `[Earlier conversation summary: ...]` so it can be identified reliably.

---

### Composing Both Plugins

```typescript
import { compressionPlugin, toolResultMaskingPlugin } from '@agentionai/agents/history/plugins';

const maskingPlugin = toolResultMaskingPlugin({
  keepRecentResults: 1,
  exclude: ['calculator'],
});

const history = new History([], { maxTokens: 20000 })
  .use(maskingPlugin)
  .use(compressionPlugin(summaryAgent, {
    autoReduceWhen: { maxTokens: 6000 }, // compress automatically when over budget
  }));

history.on('pluginError', (error, _plugin, hook) => {
  console.error(`[${hook}]`, error.message);
});

const agent = new ClaudeAgent(
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'A helpful assistant.',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',
    tools: [maskingPlugin.retrieveTool, searchTool, calculatorTool],
  },
  history
);

// ... run your conversation — compression fires automatically ...

console.log(`${history.length} entries, ~${history.totalEstimatedTokens} tokens`);
```

### Writing a Custom Plugin

Plugins are plain objects. Here is a minimal logging plugin:

```typescript
const loggingPlugin: HistoryPlugin = {
  afterAdd(history) {
    console.log(
      `[history] ${history.length} entries, ~${history.totalEstimatedTokens} tokens`
    );
  },
};

history.use(loggingPlugin);
```

And a custom reduce strategy:

```typescript
import type { HistoryPlugin, ReducibleEntry, ReduceOptions } from '@agentionai/agents/history';

const dropOldestPlugin: HistoryPlugin = {
  async reduce(entries: ReducibleEntry[], options: ReduceOptions) {
    if (!options.maxEntries) return entries;
    const nonSystem = entries.filter(e => e.role !== 'system');
    const system = entries.filter(e => e.role === 'system');
    return [...system, ...nonSystem.slice(-options.maxEntries)];
  },
};

history.use(dropOldestPlugin);
await history.reduce({ maxEntries: 20 });
```

---

## Advanced Usage

### Transient History

Create temporary history that is cleared before each agent execution:

```typescript
const tempHistory = new History([], { transient: true });
```

### Bounded History

Use constructor options instead of subclassing for simple sliding-window behaviour:

```typescript
// Keep at most 100 entries; drop oldest when exceeded
const history = new History([], { maxLength: 100 });

// Keep entries within a token budget; drop oldest when exceeded
const history = new History([], { maxTokens: 8000 });

// Both constraints at once
const history = new History([], { maxLength: 100, maxTokens: 8000 });
```

### Filtering History

```typescript
// Get only user messages
const userMessages = history.getEntries().filter(e => e.role === 'user');

// Get entries with tool use
const toolUsage = history.getEntries().filter(e =>
  e.content.some(c => c.type === 'tool_use')
);

// Get text content only
const textOnly = history.getEntries().map(e => ({
  role: e.role,
  text: e.content
    .filter(c => c.type === 'text')
    .map(c => (c as { text: string }).text)
    .join('\n')
}));
```

## Provider Transformers

The history system uses transformers to convert between the normalized format and provider-specific formats. This happens automatically when you use agents.

Available transformers (internal use):
- `anthropicTransformer` - Anthropic's MessageParam format
- `openAiTransformer` - OpenAI's ResponseInputItem format
- `mistralTransformer` - Mistral's message format
- `geminiTransformer` - Google's Content format

These transformers ensure seamless compatibility across all supported LLM providers.

## Best Practices

1. **Share history between agents** when you want different providers to maintain context
2. **Use persistent storage** (Redis, database) for production applications
3. **Implement auto-save** using event listeners to ensure no data loss
4. **Use transient history** for temporary conversations or testing
5. **Extend the History class** for custom storage needs; use plugins for context strategies
6. **Register a `pluginError` handler** to surface async plugin failures in production
7. **Add `maskingPlugin.retrieveTool`** to your agent whenever you use `toolResultMaskingPlugin`
8. **Use `autoReduceWhen`** on `compressionPlugin` so compression fires automatically; fall back to manual `history.reduce()` for one-off or session-end compression
9. **Use `history.getEntries()`** (not `.entries`) when reading history for display or debugging, so transform plugins are applied consistently

## Summary

The Agention history system provides:
- Provider-agnostic conversation storage
- Easy sharing between different LLM providers
- Built-in Redis support for persistence
- Simple extension mechanism for custom storage backends
- Plugin system for read-time transforms and async compression
- Built-in tool result masking (lossless, zero-cost) and rolling LLM summarization
- Event-driven architecture for reactive updates
- Serialization and cloning capabilities

This design ensures your conversation data is portable, maintainable, and token-efficient for production use.
