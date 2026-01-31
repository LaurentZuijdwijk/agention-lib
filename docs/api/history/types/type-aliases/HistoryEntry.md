# Type Alias: HistoryEntry

> **HistoryEntry** = `object`

A single entry in the conversation history.

This is the normalized format that all providers transform to/from.

## Examples

```typescript
const entry: HistoryEntry = {
  role: "user",
  content: [{ type: "text", text: "Hello" }]
};
```

```typescript
const entry: HistoryEntry = {
  role: "assistant",
  content: [
    { type: "text", text: "I'll help you with that." },
    { type: "tool_use", id: "call_123", name: "get_weather", input: { city: "Paris" } }
  ]
};
```

```typescript
const entry: HistoryEntry = {
  role: "user",
  content: [{ type: "tool_result", tool_use_id: "call_123", content: "22°C, sunny" }]
};
```

## Properties

### content

> **content**: [`MessageContent`](MessageContent.md)[]

***

### meta?

> `optional` **meta**: [`ProviderMeta`](ProviderMeta.md)

***

### role

> **role**: [`MessageRole`](MessageRole.md)
