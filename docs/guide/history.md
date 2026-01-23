# History Management

Agention provides a powerful, provider-agnostic history system that enables conversation persistence, sharing between agents of different providers, and easy extensibility to custom storage backends.

## Overview

The history system normalizes conversation data into a shared format that can be:
- Transformed to any LLM provider's native format (Anthropic, OpenAI, Mistral, Gemini)
- Shared between agents using different providers
- Persisted to various storage backends (memory, Redis, custom)
- Extended with your own storage mechanisms

## Basic Usage

### In-Memory History

```typescript
import { History } from '@agentionai/agents';

const history = new History();

// Add text messages
history.addText('user', 'Hello!');
history.addText('assistant', 'Hi there!');

// Get all entries
const entries = history.entries;

// Clear history
history.clear();
```

### Sharing History Between Agents

```typescript
import { ClaudeAgent, OpenAiAgent, History } from '@agentionai/agents';

// Create a shared history
const sharedHistory = new History();

// Both agents use the same conversation history
const claudeAgent = new ClaudeAgent(
  { model: 'claude-sonnet-4-20250514' },
  sharedHistory
);

const openAiAgent = new OpenAiAgent(
  { model: 'gpt-4o' },
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
import { text, toolUse, toolResult, textMessage } from '@agentionai/agents';

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
// Get all entries
const entries = history.entries;

// Get number of entries
const count = history.length;

// Get total content size in characters
const size = history.size;

// Get the last entry
const last = history.lastEntry();

// Get system message
const systemMsg = history.getSystemMessage();

// Get all messages without system messages
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
import { RedisHistory } from '@agentionai/agents';
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
  { model: 'claude-sonnet-4-20250514' },
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

const agent = new ClaudeAgent({ model: 'claude-sonnet-4-20250514' }, history);
await agent.execute('Hello!'); // Automatically saved
```

## Custom Storage Backends

The history system is easily extended to support any storage mechanism. Simply extend the `History` class:

```typescript
import { History, HistoryEntry } from '@agentionai/agents';

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
import { History } from '@agentionai/agents';
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
    const serialized = this.toJSON();
    
    await fs.writeFile(filePath, serialized, 'utf-8');
  }
}

// Usage
const history = new FileHistory('./conversations');
await history.load('user123');

const agent = new ClaudeAgent({ model: 'claude-sonnet-4-20250514' }, history);
await agent.execute('Hello!');

await history.save('user123');
```

### Example: MongoDB History

```typescript
import { History } from '@agentionai/agents';
import { MongoClient, Db } from 'mongodb';

class MongoHistory extends History {
  constructor(private db: Db, private collection: string = 'conversations') {
    super([], { transient: false });
  }

  async load(conversationId: string): Promise<void> {
    const doc = await this.db
      .collection(this.collection)
      .findOne({ _id: conversationId });
    
    if (doc && doc.entries) {
      this._entries = doc.entries;
    }
  }

  async save(conversationId: string): Promise<void> {
    await this.db.collection(this.collection).updateOne(
      { _id: conversationId },
      { 
        $set: { 
          entries: this._entries,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
}

// Usage
const client = await MongoClient.connect('mongodb://localhost:27017');
const db = client.db('myapp');

const history = new MongoHistory(db);
await history.load('conversation123');
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
```

## Advanced Usage

### Transient History

Create temporary history that won't be persisted:

```typescript
const tempHistory = new History([], { transient: true });
```

### History with Max Length

Implement a sliding window history:

```typescript
class BoundedHistory extends History {
  constructor(private maxEntries: number) {
    super();
  }

  override addEntry(entry: HistoryEntry): void {
    super.addEntry(entry);
    
    // Keep only the last N entries
    if (this._entries.length > this.maxEntries) {
      this._entries = this._entries.slice(-this.maxEntries);
    }
  }
}

const history = new BoundedHistory(100); // Keep last 100 entries
```

### Filtering History

```typescript
// Get only user messages
const userMessages = history.entries.filter(e => e.role === 'user');

// Get entries with tool use
const toolUsage = history.entries.filter(e =>
  e.content.some(c => c.type === 'tool_use')
);

// Get text content only
const textOnly = history.entries.map(e => ({
  role: e.role,
  text: e.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
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
5. **Extend the History class** for custom storage needs rather than reimplementing
6. **Monitor history size** and implement cleanup strategies for long-running conversations
7. **Use serialization** for backups and exports

## Summary

The Agention history system provides:
- Provider-agnostic conversation storage
- Easy sharing between different LLM providers
- Built-in Redis support for persistence
- Simple extension mechanism for custom storage
- Event-driven architecture for reactive updates
- Serialization and cloning capabilities

This design ensures your conversation data is portable, maintainable, and ready for production use.
