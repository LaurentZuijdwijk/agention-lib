# Type Alias: HistoryEntry

> **HistoryEntry** = `object`

Defined in: [lib/history/types.ts:131](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/history/types.ts#L131)

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

Defined in: [lib/history/types.ts:133](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/history/types.ts#L133)

***

### meta?

> `optional` **meta**: [`ProviderMeta`](ProviderMeta.md)

Defined in: [lib/history/types.ts:134](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/history/types.ts#L134)

***

### role

> **role**: [`MessageRole`](MessageRole.md)

Defined in: [lib/history/types.ts:132](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/history/types.ts#L132)
