# Type Alias: HistoryEntry

> **HistoryEntry** = `object`

Defined in: [lib/history/types.ts:119](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/history/types.ts#L119)

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

Defined in: [lib/history/types.ts:121](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/history/types.ts#L121)

***

### meta?

> `optional` **meta**: [`ProviderMeta`](ProviderMeta.md)

Defined in: [lib/history/types.ts:122](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/history/types.ts#L122)

***

### role

> **role**: [`MessageRole`](MessageRole.md)

Defined in: [lib/history/types.ts:120](https://github.com/LaurentZuijdwijk/agention-lib/blob/31a59990a96d380979746c92f9352754e543efee/lib/history/types.ts#L120)
