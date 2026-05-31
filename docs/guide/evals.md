# Evaluation

`@agentionai/eval` is a TypeScript eval framework for the agents and pipelines you build with Agention. Unit tests tell you whether your code runs; evals tell you whether it's *good* — whether your invoice extractor handles 500 real documents, whether Haiku is accurate enough to replace Sonnet on your task, or whether last week's prompt change introduced a regression.

You run your agents against a representative dataset, score the outputs with deterministic checks or a judge agent, and gate deploys on quality thresholds — all in TypeScript, no config files.

## Installation

`@agentionai/eval` is a separate package that peer-depends on `@agentionai/agents`:

```bash
npm install @agentionai/eval @agentionai/agents
```

## Your First Eval

Any Agention `Pipeline`, `AgentGraph`, `GraphNode`, or plain object with an `execute()` method is a valid eval target — no wrapping required.

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { EvalDataset, EvalRunner, EvalThresholdError, Scorer, formatReport } from '@agentionai/eval';

const agent = new ClaudeAgent({
  id: 'extractor',
  name: 'Extractor',
  description: 'Extract the invoice number and total. Return JSON: { invoice_no: string, total: number }',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.1,
});

const dataset = new EvalDataset([
  { input: 'Invoice INV-001. Total due: $1,250.00', expected: { invoice_no: 'INV-001', total: 1250 } },
  { input: 'Ref: INV-002. Amount: £890.50',         expected: { invoice_no: 'INV-002', total: 890.5 } },
]);

const runner = new EvalRunner({
  target: agent,
  dataset,
  scorers: [Scorer.fieldAccuracy(['invoice_no', 'total'], { tolerance: 0.01 })],
  failIf: { passRate: { lt: 0.9 } },
});

try {
  const report = await runner.run();
  console.log(formatReport(report));
} catch (err) {
  if (err instanceof EvalThresholdError) {
    console.log(formatReport(err.report));
    process.exit(1);
  }
}
```

## Datasets

An `EvalDataset` wraps a list of cases. Each case has an `input`, an optional `expected` value, optional `metadata` (useful for grouping results — see [Reports](#reports)), and an optional `name` describing what it verifies. The `name` becomes the test description in every report — `ok N - <name>` in TAP, and the failed-case header in the human-readable output — falling back to a preview of the input when omitted, so prefer a short behavioural label over relying on the raw input.

```typescript
// From an array
const dataset = new EvalDataset([
  { name: 'handles thousands separator', input: 'Total: $1,250.00', expected: { total: 1250 } },
  { input: 'text', expected: { field: 'value' }, metadata: { source: 'doc-1' } },
]);

// From a JSONL file (one EvalCase object per line)
const dataset = await EvalDataset.fromJsonl<string>('./cases.jsonl');

// From raw rows with a mapper
const dataset = EvalDataset.fromArray(rawRows, (row) => ({
  input: row.text,
  expected: { total: row.amount },
  metadata: { document_type: row.type },
}));
```

## Scorers

A scorer inspects an output and returns `{ pass, score, reason }`. A case passes only when **every** scorer passes. Combine cheap deterministic checks with an expensive judge so you fail fast before spending judge tokens.

### `Scorer.fieldAccuracy(fields, options?)`

The workhorse for structured extraction. It parses the output as JSON and fuzzy-matches the listed fields against `expected`, normalising the messy reality of LLM output before comparing:

| Output string | Normalised to |
|---|---|
| `"$1,250.00"` / `"£890.50"` / `"€2.400,00"` | `1250` / `890.5` / `2400` |
| `"Yes"` / `"true"` / `"1"` | `true` |
| `"No"` / `"false"` / `"0"` | `false` |
| `"25%"` | `25` |

The `tolerance` option sets the maximum relative error for numeric fields (`0.01` = 1%).

```typescript
Scorer.fieldAccuracy(['invoice_no', 'total', 'vendor'], { tolerance: 0.01 })
```

### `Scorer.jsonSchema(schema)`

Passes if the output parses as JSON and validates against a Zod schema or a plain JSON Schema object.

```typescript
import { z } from 'zod';

Scorer.jsonSchema(z.object({ total: z.number(), vendor: z.string() }))

Scorer.jsonSchema({ type: 'object', required: ['total'], properties: { total: { type: 'number' } } })
```

### `Scorer.exactMatch(fields?)`

Parses the output as JSON and compares fields against `expected` with the same value normalisation as `fieldAccuracy`. If `fields` is omitted, every key in `expected` is checked.

```typescript
Scorer.exactMatch()                        // check all fields
Scorer.exactMatch(['invoice_no', 'total']) // check specific fields
```

### `Scorer.contains(keywords, options?)`

Passes if every keyword appears in the output. Case-insensitive by default.

```typescript
Scorer.contains(['invoice', 'total'])
Scorer.contains(['INV-001'], { caseSensitive: true })
```

### `Scorer.toolCalls(expected, options?)`

Scores the **tools the agent actually called** during the case — which a string scorer can't see. The runner reads each case's tool-call trace from the agent's history and hands it to this scorer.

`expected` is the tools you expect, each as a name or `{ name, input }`. When you give an `input`, only the keys you list are compared (a partial match), so you can assert just the arguments that matter:

```typescript
// Order-independent: these tools were called, with these key arguments
Scorer.toolCalls([
  { name: 'search_flights', input: { from: 'SFO', to: 'JFK' } },
  'book_flight',
])

// Strict: exactly these tools, in this order, and nothing else
Scorer.toolCalls(['get_weather', 'send_email'], { ordered: true, allowExtra: false })
```

Options: `ordered` (default `false`) requires the expected calls to appear in order; `allowExtra` (default `true`) permits additional calls beyond those expected — set it `false` to also fail on unexpected calls. The trace is also available on each `EvalCaseResult.toolCalls` and to `Scorer.custom` via its `context` argument:

```typescript
Scorer.custom('noWrites', async (_output, _expected, _input, context) => {
  const wrote = context?.toolCalls.some((c) => c.name.startsWith('write_')) ?? false;
  return { pass: !wrote, score: wrote ? 0 : 1, scorerName: 'noWrites' };
})
```

::: tip Tool-call capture is automatic
Any target exposing `getHistoryEntries()` (every Agention agent does) yields its trace with no setup. As with token counts, keep `concurrency: 1` when the target shares history across cases so calls stay attributed to the right case.
:::

### `Scorer.custom(name, fn)`

The escape hatch for anything the built-ins don't cover. The fourth `context` argument exposes the tool-call trace (see [`toolCalls`](#scorer-toolcalls-expected-options) above).

```typescript
Scorer.custom('wordCount', async (output, expected) => {
  const count = output.split(' ').length;
  const pass = count <= (expected as number);
  return { pass, score: pass ? 1 : 0, scorerName: 'wordCount' };
})
```

## LLM-as-Judge

Deterministic scorers verify structure and values, but they can't tell you whether an answer is *accurate*, a summary is *faithful*, or a tone is right. For that, use a judge agent.

`Scorer.llm()` sends the full context — `input`, `output`, `expected`, and your `criteria` — to a judge and asks for `{ score, reason }` JSON. The score is normalised to 0–1, and the `reason` surfaces in every report, making failures self-explanatory.

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { Scorer } from '@agentionai/eval';

// Use a cheap model for the judge, and temperature 0 — judge variance would
// make scores incomparable between runs and between targets.
const judge = new ClaudeAgent({
  id: 'judge',
  name: 'Judge',
  description: 'You are a precise evaluation judge. Return only JSON.',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-haiku-4-5-20251001',
  temperature: 0,
});

Scorer.llm(judge, {
  criteria: 'Does the summary faithfully cover the key points in the Expected field? Penalise omissions and hallucinations.',
  scale: 5,          // score range 1–5, normalised to 0–1 (default: 5)
  passingScore: 0.6, // 3/5 or above passes (default: 0.6)
})
```

::: tip Layer cheap checks before the judge
`Scorer.llm` is semantically rich but costs tokens. Put free structural checks first — a case fails as soon as any scorer fails, so a bad output never reaches the judge.

```typescript
scorers: [
  Scorer.contains(['total', 'invoice_no']),              // free
  Scorer.fieldAccuracy(['total'], { tolerance: 0.01 }),  // free
  Scorer.llm(judge, { criteria: 'Is the extraction faithful?' }), // costs tokens
]
```
:::

## Comparing Models and Prompts

`EvalRunner.compare()` runs the same dataset and scorers against multiple named targets and returns one report per target — each with its own pass rate, scores, and [token cost](#token-usage-cost). Use it to find the cheapest model that meets your quality bar, or to A/B test prompt variants.

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';

const reports = await EvalRunner.compare(dataset, [
  Scorer.fieldAccuracy(['invoice_no', 'total'], { tolerance: 0.01 }),
  Scorer.llm(judge, { criteria: 'Is the extraction faithful to the source?' }),
], {
  'claude-haiku':  new ClaudeAgent({ /* ... */ model: 'claude-haiku-4-5-20251001', temperature: 0.3 }),
  'claude-sonnet': new ClaudeAgent({ /* ... */ model: 'claude-sonnet-4-6',         temperature: 0.3 }),
  'gpt-4o-mini':   new OpenAiAgent({ /* ... */ model: 'gpt-4o-mini',               temperature: 0.3 }),
});

for (const [model, report] of Object.entries(reports)) {
  console.log(`\n--- ${model} ---`);
  console.log(formatReport(report));
}
```

::: warning compare() always returns every report
`compare()` deliberately takes no `failIf` — aborting mid-comparison would throw away the other targets' results. Share one judge across all targets (at `temperature: 0`) so scores stay comparable, and gate on thresholds per-target *after* `compare()` returns. Pass `{ concurrency }` as the optional fourth argument to run cases in parallel.
:::

### Comparing prompts head-to-head

To pick the best of several prompts, **don't** score each independently with `Scorer.llm` and rank by mean score — pointwise absolute scoring saturates. On an easy task the judge rates every output 5/5, so all variants tie at 100% and you learn nothing.

`EvalRunner.rank()` fixes this: for each case it runs every target, then asks a single judge to **rank the outputs against each other**. Relative judgments are far more discriminating than absolute ones (it's how arena-style evals work). Candidates are anonymised and shuffled per case, so the judge can't anchor on a target's name or position.

```typescript
const make = (id: string, description: string) =>
  new ClaudeAgent({ id, name: id, description, apiKey, model, temperature: 0.3 });

const report = await EvalRunner.rank({
  dataset,
  judge,   // shared, temperature 0
  criteria: 'Which summary most faithfully and concisely covers the key points, without omissions or additions?',
  targets: {
    'minimal':  make('minimal',  'Summarise the text.'),
    'explicit': make('explicit', 'Summarise in 1–2 sentences. Do not add information.'),
    'framed':   make('framed',   'Write a one-sentence abstract. Capture only the facts.'),
  },
});

report.leaderboard.forEach((t, i) =>
  console.log(`${i + 1}. ${t.name.padEnd(12)} wins: ${t.wins}  points: ${t.points}  avg rank: ${t.averageRank.toFixed(2)}`)
);
```

`rank()` requires at least two targets and returns a `RankReport`: a `leaderboard` (sorted best→worst, each with `wins`, Borda `points`, and `averageRank`) and per-case `cases` (every target's `outputs`, the judge's `ranking`, and its `reason`). A case the judge can't rank cleanly is skipped in the aggregate.

## PDF / Document Extraction

The primary use case. `fieldAccuracy` absorbs currency symbols, number formatting, and boolean strings, so you don't normalise before comparing. Group results by a metadata key to spot per-segment regressions.

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { z } from 'zod';
import { EvalDataset, EvalRunner, Scorer, formatReport } from '@agentionai/eval';

const extractor = new ClaudeAgent({
  id: 'extractor',
  name: 'Invoice Extractor',
  description: 'Extract invoice fields. Return JSON only: { invoice_no, date, vendor, total }.',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.1,
});

const dataset = new EvalDataset([
  {
    input: 'INVOICE\nFrom: Acme Corp\nInvoice #: INV-001\nDate: January 15, 2024\nTotal Due: $1,250.00',
    expected: { invoice_no: 'INV-001', date: '2024-01-15', vendor: 'Acme Corp', total: 1250 },
    metadata: { document_type: 'invoice' },
  },
]);

const runner = new EvalRunner({
  target: extractor,
  dataset,
  scorers: [
    Scorer.jsonSchema(z.object({
      invoice_no: z.string(),
      date: z.string(),
      vendor: z.string(),
      total: z.number(),
    })),
    Scorer.fieldAccuracy(['invoice_no', 'vendor', 'total'], { tolerance: 0.01 }),
  ],
  failIf: { scores: { fieldAccuracy: { lt: 0.95 } } },
});

const report = await runner.run();
console.log(formatReport(report, { groupBy: 'document_type' }));
```

## Token Usage & Cost

Per-case token counts are captured **automatically** for agent targets — every Agention agent exposes its usage after each `execute()` (via `lastTokenUsage`), and the runner reads it with no setup. Counts appear on each `EvalCaseResult` and aggregate into `report.tokenCost`, which is what makes the cost comparison in [`compare()`](#comparing-models-and-prompts) work.

```typescript
const runner = new EvalRunner({
  target: extractor,
  dataset,
  scorers,
  concurrency: 1, // keep at 1 for accurate per-case attribution (see below)
  onCaseComplete(result, index) {
    console.log(`[${index + 1}] ${result.pass ? '✓' : '✗'}  tokens: ${result.tokens?.total ?? '—'}`);
  },
});
```

For composite **graph / pipeline** targets, token usage flows through a [`MetricsCollector`](/guide/graph-pipelines#metrics-observability) instead. Create one, wire it to the pipeline with `.withMetrics()`, and pass it to the runner:

```typescript
import { createMetricsCollector } from '@agentionai/agents';

const metrics = createMetricsCollector();
const pipeline = AgentGraph.pipeline(classify, extract).withMetrics(metrics);

const runner = new EvalRunner({ target: pipeline, dataset, scorers, metrics });
```

::: warning Per-case counts need serial execution
Per-case token counts are accurate at `concurrency: 1` and approximate otherwise — a shared target's usage is overwritten by overlapping cases. Run serially when the exact per-case figures matter.
:::

## CI Thresholds

`failIf` makes `runner.run()` throw `EvalThresholdError` when quality drops below a threshold, which exits the process non-zero in CI. The full report is attached to the error, so you can still print it.

```typescript
import { EvalThresholdError } from '@agentionai/eval';

try {
  const report = await runner.run();
  console.log(formatReport(report));
} catch (err) {
  if (err instanceof EvalThresholdError) {
    console.log(formatReport(err.report)); // full report on the error
    console.error(err.violations);         // ['passRate 66.7% < 80.0%', ...]
    process.exit(1);
  }
}
```

```typescript
failIf: {
  passRate: { lt: 0.8 },          // fewer than 80% of cases pass
  scores: {
    fieldAccuracy: { lt: 0.95 },  // mean field accuracy below 95%
    llm:           { lt: 0.6 },   // mean judge score below 60%
  },
}
```

Supported operators: `lt` (less than) and `lte` (less than or equal).

## Use with `node:test`

You don't need a bespoke `describe`/`it` API — evals compose *into* the test runner you already use. Run the dataset once, then surface each case as a native subtest. You get familiar BDD output, `--test-reporter` formats, watch mode, and CI integration for free, with the scorers doing the judging. The case [`name`](#datasets) becomes the test description.

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EvalDataset, EvalRunner, Scorer } from '@agentionai/eval';

const dataset = new EvalDataset([
  { name: 'uppercases a single word', input: 'hello', expected: { value: 'HELLO' } },
  // ...
]);

// Run once; every subtest awaits the same promise, so the eval never re-runs.
const reportPromise = new EvalRunner({ target, dataset, scorers }).run();

describe('uppercase extractor', () => {
  dataset.cases.forEach((evalCase, i) => {
    it(evalCase.name ?? JSON.stringify(evalCase.input), async () => {
      const result = (await reportPromise).cases[i];
      const reasons = result.scores.filter((s) => !s.pass).map((s) => `${s.scorerName}: ${s.reason}`);
      assert.ok(result.pass, reasons.join('\n'));
    });
  });
});

// Suite-level quality gates — the node:test equivalent of failIf.
describe('quality gates', () => {
  it('passes at least 90% of cases', async () => {
    const { passRate } = await reportPromise;
    assert.ok(passRate >= 0.9, `pass rate ${(passRate * 100).toFixed(1)}%`);
  });
});
```

```bash
node --import tsx --test eval.test.ts                      # run
node --import tsx --test --test-reporter=spec eval.test.ts # pretty
node --import tsx --test --watch eval.test.ts              # watch
```

```
▶ uppercase extractor
  ✔ uppercases a single word (1.5ms)
  ✔ trims surrounding whitespace (0.3ms)
  ✔ computes the correct length (0.3ms)
```

A failing case surfaces the scorer's `reason` in the assertion error. The same shape works with Vitest or Jest — they all consume the report the same way.

## Reports

`formatReport(report, options?)` renders a standalone human-readable summary (when you're *not* running inside a test runner). Pass `groupBy` with a metadata key to see per-segment pass rates.

```typescript
console.log(formatReport(report));
console.log(formatReport(report, { groupBy: 'document_type' }));
```

```
=== Eval Report ===
Passed:   8 / 10 (80.0%)
Failed:   2
Duration: 3,241ms
Tokens:   12,450 total (1245.0 / case)

Scorer Results:
  jsonSchema           [████████████████████]  1.000
  fieldAccuracy        [████████████████░░░░]  0.800
  llm                  [███████████████░░░░░]  0.740

Results by document_type:
  invoice                  5/6 (83.3%)
  receipt                  3/4 (75.0%)

Failed Cases (2):
  input: "INVOICE\nFrom: Acme Corp..."
    [FAIL] fieldAccuracy: total: expected 1250, got 1150
    [FAIL] llm: The summary omits the vendor name entirely.
```

### TAP output

`formatReportTap(report)` produces a valid [TAP 14](https://testanything.org/) string you can pipe to any TAP consumer for pretty output or CI integration:

```typescript
import { formatReportTap } from '@agentionai/eval';
process.stdout.write(formatReportTap(report));
```

```bash
node --import tsx eval.ts | npx tap-spec               # pretty terminal output
node --import tsx eval.ts | npx tap-junit > results.xml # JUnit XML for CI
node --import tsx eval.ts | npx tap-dot                 # dot reporter
```

## EvalRunner Options

```typescript
new EvalRunner({
  target,       // EvalTarget — any object with execute()
  dataset,      // EvalDataset
  scorers,      // IScorer[] — applied to every case
  concurrency,  // parallel case execution (default: 1)
  metrics,      // MetricsCollector — only for graph/pipeline targets
  failIf,       // EvalFailConditions — throw EvalThresholdError if not met
  onCaseComplete(result, index) {
    const llm = result.scores.find((s) => s.scorerName === 'llm');
    console.log(result.pass ? 'PASS' : 'FAIL', llm?.reason);
  },
});
```

Error isolation is built in: a case whose target throws produces `pass: false` with the error in `reason` — it never crashes the run.

## Core Types

```typescript
interface EvalCase<TInput = string> {
  input: TInput;
  expected?: unknown;
  metadata?: Record<string, unknown>;
  name?: string;           // test description; falls back to an input preview
}

interface EvalCaseResult<TInput = string> {
  case: EvalCase<TInput>;
  output: string;
  scores: ScorerResult[];
  pass: boolean;           // true only if every scorer passed
  durationMs: number;
  tokens?: { input: number; output: number; total: number };
}

interface EvalReport<TInput = string> {
  passed: number;
  failed: number;
  total: number;
  passRate: number;
  scores: Record<string, number>;  // scorer name → mean score across all cases
  tokenCost: { total: number; perCase: number };
  durationMs: number;
  cases: EvalCaseResult<TInput>[];
}

// Structural — satisfied by any Agention Pipeline, AgentGraph, or GraphNode
interface EvalTarget<TInput = string> {
  execute(input: TInput): Promise<string | { toString(): string }>;
}
```

## Next Steps

- [Graph Pipelines](/guide/graph-pipelines) - Build the pipelines you'll evaluate
- [Agents](/guide/agents) - Configure the models and prompts you compare
- [FAQ](/guide/faq) - Common questions
