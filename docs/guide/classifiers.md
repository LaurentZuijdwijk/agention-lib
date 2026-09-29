# Classifiers

A **classifier** is a fast, non-generative decision model: you give it some context and a closed set of labeled options, and it answers with one of those options — plus, when the backend reports one, a confidence score and a full probability distribution — instead of generating text. [TypeSafe AI's Jev](https://www.typesafe.ai) is the model this support was built around, but the `Classifier` interface is provider-agnostic, so any similarly-shaped fast-classifier backend fits the same seams.

Two places in agention-lib can use a classifier instead of an LLM call:

- **Gating a tool call** — vet a proposed tool call and block it before it runs, with a reason the calling agent can see.
- **Routing** — pick a handler for a request ([`RouterExecutor`](/guide/graph-pipelines#routerexecutor)) without spending a generation call on the decision.

```
Agent  ──→  Tool.execute()  ──→  classifierToolGuard()  ──→  Classifier  ──→  allow / block
RouterExecutor.execute()    ──→  Classifier.classify()  ──→  route name
```

## Installation

`JevClassifier` wraps [`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript), an optional peer dependency — install it when you use Jev:

```bash
npm install @typesafe-ai/sdk
```

It's loaded lazily, so importing `@agentionai/agents/classifiers` never requires the package to be installed — only calling `classify()` does.

## Quick Start

```typescript
import { JevClassifier } from '@agentionai/agents/classifiers';

const classifier = new JevClassifier({ apiKey: process.env.TYPESAFE_API_KEY });

const result = await classifier.classify({
  context: { ticket: 'I was charged twice. Please fix this ASAP.' },
  question: 'What is this ticket about?',
  options: ['billing', 'technical', 'account'],
});

console.log(result.choice);         // "billing"
console.log(result.confidence);     // 0.94
console.log(result.probabilities);  // { billing: 0.94, technical: 0.04, account: 0.02 }
```

`context` can be structured data (an object) or plain text. `options` is the closed set of labels the classifier must pick from — its answer is always exactly one of them. The optional `optionDescriptions` (`{ label: description }`) tells the classifier what each label means; `RouterExecutor` fills it from each route's `description`.

### Using Jev through OpenRouter

OpenRouter serves Jev on its System One API, billed to your OpenRouter account — no TypeSafe account needed. Point the classifier at it with `baseURL` and use your OpenRouter key:

```typescript
const classifier = new JevClassifier({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api',
  model: 'jev-latest', // routed as ~typesafe/jev-latest; or pin e.g. 'jev-1.13'
});
```

The SDK also reads `TYPESAFE_BASE_URL` and `TYPESAFE_API_KEY`, so setting those two environment variables works without changing the constructor.

## Gating Tool Calls

`classifierToolGuard()` adapts a `Classifier` into a [`Tool` guard](/guide/tools#async-guards): before the tool executes, the classifier is asked whether the call should be allowed, and the call is blocked — with a reason surfaced back to the calling agent — if not.

```typescript
import { JevClassifier, classifierToolGuard } from '@agentionai/agents/classifiers';

const classifier = new JevClassifier({ apiKey: process.env.TYPESAFE_API_KEY });

deleteFileTool.addGuard(
  classifierToolGuard(classifier, {
    question: 'Is it safe to delete this file path without asking the user first?',
    reason: (result) =>
      `Refused: this looks unsafe (confidence ${result.confidence}). Ask the user to confirm.`,
  })
);
```

The agent sees the guard's reason as the tool's (failed) result and can adjust — ask the user, try a narrower request, and so on — rather than just getting a generic refusal.

### Guard Options

| Option | Type | Default | Description |
|---|---|---|---|
| `question` | `string` | `"Should this tool call be allowed?"` | The question posed to the classifier |
| `allowChoice` | `string` | `"allow"` | Option label meaning "allow" |
| `blockChoice` | `string` | `"block"` | Option label meaning "block" |
| `minConfidence` | `number` | unset | Minimum confidence in a "block" verdict required to actually block. Unset blocks on **any** "block" verdict — the safe-by-default choice; loosen it deliberately |
| `reason` | `(result: ClassifyResult) => string` | generic message | Builds the reason surfaced to the agent when blocked |

Register a guard on every tool in a belt to apply it uniformly:

```typescript
for (const tool of dangerousTools) {
  tool.addGuard(classifierToolGuard(classifier));
}
```

See the full example: [`examples/classifier-tool-guard.ts`](https://github.com/laurentzuijdwijk/agention-lib/blob/main/examples/classifier-tool-guard.ts).

## Routing Without an LLM Call

[`RouterExecutor`](/guide/graph-pipelines#routerexecutor) normally spends a full LLM generation call asking a router agent to name a route, then fuzzy-matches the free-text response. Passing a `Classifier` instead skips both steps — the classifier's option set is exactly the route names, so its answer is already a valid route:

```typescript
import { RouterExecutor } from '@agentionai/agents';
import { JevClassifier } from '@agentionai/agents/classifiers';

const router = new RouterExecutor(new JevClassifier({ apiKey: process.env.TYPESAFE_API_KEY }), [
  { name: 'technical', description: 'Technical questions about code', handler: techAgent },
  { name: 'billing', description: 'Questions about charges or invoices', handler: billingAgent },
]);

const result = await router.execute('I was charged twice for my subscription this month.');
```

Customize the question sent to a classifier router with `classifierQuestion` (ignored for an LLM router, which uses `promptTemplate` instead):

```typescript
new RouterExecutor(classifier, routes, {
  classifierQuestion: 'Which team should handle this request?',
});
```

See the full example: [`examples/classifier-routing.ts`](https://github.com/laurentzuijdwijk/agention-lib/blob/main/examples/classifier-routing.ts).

## API Reference

### `Classifier`

```typescript
interface Classifier {
  classify(request: ClassifyRequest, options?: ClassifyOptions): Promise<ClassifyResult>;
}
```

| Type | Fields |
|---|---|
| `ClassifyRequest` | `context: Record<string, unknown> \| string`, `question: string`, `options: string[]`, `optionDescriptions?: Record<string, string>` |
| `ClassifyResult` | `choice: string`, `confidence?: number`, `probabilities?: Record<string, number>`, `raw?: unknown` |
| `ClassifyOptions` | `signal?: AbortSignal`, `timeout?: number` |

`isClassifier(value)` duck-types a value as a `Classifier`, for APIs (like `RouterExecutor`) that accept one alongside a `BaseAgent`.

### `JevClassifier`

```typescript
new JevClassifier(config?: {
  apiKey?: string;      // falls back to TYPESAFE_API_KEY
  baseURL?: string;
  model?: string;       // passed to the SDK as defaultModel
  timeout?: number;
  vendorConfig?: { jev?: Record<string, unknown> }; // escape hatch for any other client option
})
```

A cancelled classification (`options.signal` aborted) rejects with the same abort error the call would otherwise throw, rather than a wrapped `ClassifierCallError` — consistent with how every agent in this library reports cancellation.

## Not Included Yet

TypeSafe's SDK also has `noul` (yes/no probability) and `score` (rubric) question types, alongside `choice`. Neither is wired into `Classifier` — both current use cases (gating and routing) reduce to "pick one of N labeled options," so `choice` covers them. If you need `noul`/`score`, use `@typesafe-ai/sdk`'s `TypeSafeClient` directly for now.
