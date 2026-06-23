# Recipe: Ensemble solver (mixture-of-agents)

Several models each independently solve the **same** problem, then a judge
synthesizes a single best answer from their candidates. This is the
**mixture-of-agents** / LLM-ensembling pattern — and the reason it works is
diversity: different models make *different* mistakes, so a judge that combines
their strengths usually beats any single model (and beats sampling one model N
times, since those samples are correlated).

This is the inverse of a review team: instead of one author and many critics,
you have **many authors and one synthesizer**.

## How it works

The whole flow is a single `AgentGraph.pipeline`:

```
parallel(solverA, solverB, solverC)   →  string[]      (candidate solutions)
        │
to-voting-input                       →  VotingInput   (string[] → { originalInput, solutions })
        │
votingSystem(judge)                   →  string        (final synthesized answer)
```

- **`AgentGraph.parallel(...)`** runs every solver concurrently on the same
  input and collects their answers into an array — in solver order.
- A tiny inline **transform stage** reshapes that `string[]` into the
  `VotingInput` the judge expects (and prints each candidate along the way).
- **`AgentGraph.votingSystem(judge)`** asks the judge not just to *pick* a winner
  but to **synthesize** the best answer by merging the strongest parts and fixing
  mistakes it spots.

Because each stage implements the `GraphNode` interface, they compose into one
`pipeline` you can `execute()` — or drop into a larger graph.

## Run it

```bash
npm install

# Best results: give it several providers so the candidates are genuinely diverse
ANTHROPIC_API_KEY=... OPENAI_API_KEY=... MISTRAL_API_KEY=... \
  npm start "Design a rate limiter for a public API. Explain the tradeoffs."

# Works with a single key too — it falls back to diverse Claude personas
ANTHROPIC_API_KEY=... npm start
```

With multiple keys you get true cross-model diversity (Claude + GPT + Mistral).
With one key the recipe still runs by spinning up differently-tuned personas of
the same provider.

**Where diversity comes from.** You don't need different *models* to get useful
variety — any of three knobs works, and you can mix them:

- **Model** — Claude vs. GPT vs. Mistral (the strongest source of diversity).
- **Prompt** — the same model with different system prompts ("favor creative
  approaches" vs. "favor the simplest thing that works").
- **Temperature** — the same model+prompt at different sampling temperatures
  (higher = more divergent candidates). The single-key fallback in this recipe
  uses temperature `1.0` for the "lateral" persona and `0.2` for the "pragmatic"
  one.

## Why generate-then-judge?

| Pattern | Authors | Critic | Good for |
| ------- | ------- | ------ | -------- |
| **Ensemble solver** (this recipe) | many models | 1 judge synthesizes | hard problems where you want the best possible answer |
| **Review team** | 1 author | many specialist reviewers | catching defects in a single proposed solution |

## Thinking / reasoning

This is a "hard problems" recipe, so extended thinking earns its keep:

- **The judge thinks.** Comparing candidates and merging their strengths is the
  most reasoning-heavy step, and the judge is a single agent — so it always runs
  with `thinkingBudgetTokens` set.
- **Solvers think where it's free.** The Claude solver uses `thinkingBudgetTokens`
  and the OpenAI solver uses `reasoningEffort: "medium"`.
- **The one catch:** on Claude, extended thinking forces default sampling, so
  `temperature` is **ignored** when thinking is on. The two are mutually
  exclusive. That's why the single-key fallback (which gets its diversity from
  temperature) deliberately leaves thinking off — you pick one or the other per
  agent. Remember the budget must be ≥ 1024 and `< maxTokens`, and the answer
  shares `maxTokens` with the thinking, so leave headroom.

## Adapting it

- **More candidates** — add solvers (more providers, more temperatures/personas).
- **Self-consistency** — run the *same* solver several times and let the judge
  vote; cheaper, less diverse.
- **Custom judging rubric** — pass `promptTemplate` to `votingSystem()` to score
  candidates against explicit criteria.
- **Add metrics** — `.withMetrics()` on the executors to track per-stage latency
  and token usage.
