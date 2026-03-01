# Multimodal / Vision

All four providers support sending images alongside text. Pass a `MessageContent[]` array to `execute()` instead of a plain string — the provider transformer handles converting to the native format automatically.

## Image Helpers

Import the helpers from the provider sub-package or from `@agentionai/agents/core`:

```typescript
import { imageUrl, imageBase64 } from '@agentionai/agents/core';
// or from the specific provider:
import { imageUrl, imageBase64 } from '@agentionai/agents/claude';
```

### `imageUrl(url, options?)`

Reference a remote image by URL:

```typescript
imageUrl('https://example.com/photo.jpg')

// With options:
imageUrl('https://example.com/photo.jpg', {
  mimeType: 'image/jpeg',        // Recommended for Gemini (fileData)
  detail: 'high',                // OpenAI only: 'low' | 'high' | 'auto'
})
```

### `imageBase64(data, mimeType)`

Embed a local image as raw base64 — do **not** include the `data:` URI prefix:

```typescript
import * as fs from 'fs';

const data = fs.readFileSync('./photo.jpg').toString('base64');
imageBase64(data, 'image/jpeg')
```

## Sending Images

Pass a `MessageContent[]` array to `execute()`. Text and image blocks can appear in any order:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { imageUrl } from '@agentionai/agents/core';

const agent = new ClaudeAgent({
  id: 'vision',
  name: 'VisionAgent',
  description: 'You analyze images.',
  model: 'claude-opus-4-6',
});

const response = await agent.execute([
  imageUrl('https://example.com/chart.png'),
  { type: 'text', text: 'Summarize this chart in one sentence.' },
]);
```

### Local File (Base64)

```typescript
import { imageBase64 } from '@agentionai/agents/core';
import * as fs from 'fs';

const data = fs.readFileSync('./photo.jpg').toString('base64');

const response = await agent.execute([
  imageBase64(data, 'image/jpeg'),
  { type: 'text', text: 'What do you see?' },
]);
```

### Multiple Images

Combine multiple images in a single turn:

```typescript
const response = await agent.execute([
  { type: 'text', text: 'Compare these two images:' },
  imageUrl('https://example.com/before.jpg'),
  imageUrl('https://example.com/after.jpg'),
]);
```

## Provider Capability Matrix

| Provider | URL Images | Base64 Images | Notes |
|----------|:----------:|:-------------:|-------|
| **Claude** (`ClaudeAgent`) | ✅ | ✅ | — |
| **OpenAI** (`OpenAiAgent`) | ✅ | ✅ | Use `detail` option to control resolution cost |
| **Gemini** (`GeminiAgent`) | ✅ | ✅ | `mimeType` recommended for URL images |
| **Mistral** (`MistralAgent`) | ✅ | ❌ | URL only — base64 throws at runtime |

The same `MessageContent[]` array is valid across all providers. If your code needs to run on Mistral, use `imageUrl()` exclusively.

## Cross-Provider Example

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';
import { GeminiAgent } from '@agentionai/agents/gemini';
import { imageUrl } from '@agentionai/agents/core';

// Build the input once — works with any provider
const input = [
  imageUrl('https://example.com/diagram.png'),
  { type: 'text', text: 'Explain this diagram.' },
];

const claude  = new ClaudeAgent({ id: 'c', name: 'Claude', description: '...', model: 'claude-sonnet-4-5' });
const openai  = new OpenAiAgent({ id: 'o', name: 'OpenAI', description: '...', model: 'gpt-4o' });
const gemini  = new GeminiAgent({ id: 'g', name: 'Gemini', description: '...', model: 'gemini-2.0-flash' });

const [r1, r2, r3] = await Promise.all([
  claude.execute(input),
  openai.execute(input),
  gemini.execute(input),
]);
```

## TypeScript Types

```typescript
import type {
  MessageContent,
  ImageUrlContent,
  ImageBase64Content,
  ImageMimeType,
} from '@agentionai/agents/core';
```

**`ImageMimeType`** — `"image/jpeg" | "image/png" | "image/gif" | "image/webp"`

**`ImageUrlContent`**

```typescript
type ImageUrlContent = {
  type: 'image_url';
  url: string;
  mimeType?: ImageMimeType;           // Hint for Gemini
  detail?: 'low' | 'high' | 'auto';  // OpenAI only
};
```

**`ImageBase64Content`**

```typescript
type ImageBase64Content = {
  type: 'image_base64';
  data: string;          // Raw base64 — no data: URI prefix
  mimeType: ImageMimeType;
};
```

## Token Budget

The history token tracker uses a flat **1,000-token estimate per image block**, regardless of resolution. This affects `maxHistoryTokens` budget calculations. Actual provider billing is based on real image size and varies by provider.
