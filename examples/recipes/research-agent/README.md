# Recipe: Terminal research agent

An interactive command-line research assistant. Ask it a question and it uses
Claude's **server-side web search** to gather live information, **streams its
reasoning and answer** to your terminal as it works, and remembers the thread so
you can ask follow-ups. Save any answer to a Markdown file when you're happy.

## What it demonstrates

- **Built-in tools** — `webSearchTool()` is an Anthropic *server-side* tool.
  You don't implement an `execute()`; Anthropic runs the search and feeds the
  results back to the model. Pass it via `builtInTools`.
- **Streaming with reasoning** — `agent.executeStream()` yields
  `{ type: "text" | "reasoning", content }`. We dim the reasoning trace and print
  the answer in normal weight. Reasoning appears because extended thinking is
  enabled with `thinkingBudgetTokens`.
- **Conversational memory** — a single shared `History` (with a generous
  `maxTokens` budget) is passed to the agent, so follow-up questions keep context.

## Run it

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Then, in the REPL:

```
🔎 What were the biggest changes in the latest TypeScript release?
   [thinking] I should search for the current TypeScript version...
   ## Summary
   ...
   ## Sources
   - https://devblogs.microsoft.com/typescript/...
   (1843 in / 612 out tokens)

🔎 Which of those affect strict mode?      # follow-up, keeps context
🔎 save typescript-report.md               # writes the last answer to disk
🔎 reset                                   # start a fresh research thread
🔎 exit
```

## Adapting it

- **Constrain sources** — `webSearchTool({ allowedDomains: ["arxiv.org"] })` or
  `blockedDomains` to focus or filter the search.
- **Localize results** — pass `userLocation` to `webSearchTool()`.
- **Go multi-agent** — make this researcher a *sub-agent* of a planner with
  `agents: [researcher]`, or fan out parallel searches with `AgentGraph.parallel`.
- **Cheaper runs** — drop `thinkingBudgetTokens` and switch to
  `claude-haiku-4-5` for quick factual lookups.
