/**
 * Recipe: Ensemble solver (mixture-of-agents)
 * -------------------------------------------
 *
 * Several models each independently produce a candidate solution to the SAME
 * problem, then a judge synthesizes a single best answer from them. This is the
 * "mixture-of-agents" / LLM-ensembling pattern: diversity across *different*
 * models tends to beat sampling one model N times, because the candidates make
 * different mistakes and the judge can combine their strengths.
 *
 * The whole thing is one graph:
 *
 *     ┌────────────────── Pipeline ──────────────────┐
 *     │                                               │
 *     │   parallel( solverA, solverB, solverC )       │  → string[]  (candidates)
 *     │            │                                  │
 *     │   to-voting-input  (string[] → VotingInput)   │
 *     │            │                                  │
 *     │   votingSystem( judge )                       │  → string    (final answer)
 *     │                                               │
 *     └───────────────────────────────────────────────┘
 *
 * Solvers are drawn from whichever providers you have keys for (Claude, OpenAI,
 * Mistral). With a single provider it falls back to three differently-tuned
 * Claude personas so the recipe always runs.
 *
 * Run:
 *   npm install
 *   ANTHROPIC_API_KEY=... [OPENAI_API_KEY=... MISTRAL_API_KEY=...] npm start "your problem"
 */

import "dotenv/config";
import { ClaudeAgent } from "@agentionai/agents/claude";
import { OpenAiAgent } from "@agentionai/agents/openai";
import { MistralAgent } from "@agentionai/agents/mistral";
import { AgentGraph, BaseAgent, VotingInput } from "@agentionai/agents/core";

// ---------------------------------------------------------------------------
// Solvers — one per available provider, each with a distinct "voice"
// ---------------------------------------------------------------------------

const SOLVER_BRIEF = `You are an expert problem solver.
Produce a complete, self-contained solution to the user's problem.
Show your final answer clearly. Be rigorous and concise.`;

/** Build the pool of candidate solvers from whatever API keys are present. */
function buildSolvers(): BaseAgent[] {
  const solvers: BaseAgent[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    solvers.push(
      new ClaudeAgent({
        id: "claude-solver",
        name: "Claude",
        description: SOLVER_BRIEF,
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: "claude-sonnet-4-6",
        // Extended thinking → better candidates on hard problems. budget must be
        // ≥ 1024 and < maxTokens, and the answer shares the maxTokens budget with
        // the thinking, so give it headroom. NB: with thinking on, Claude ignores
        // `temperature` — that's fine here since we don't set one.
        maxTokens: 4000,
        thinkingBudgetTokens: 1500,
      })
    );
  }

  if (process.env.OPENAI_API_KEY) {
    solvers.push(
      new OpenAiAgent({
        id: "openai-solver",
        name: "GPT",
        description: SOLVER_BRIEF,
        apiKey: process.env.OPENAI_API_KEY,
        model: "gpt-4.1-mini",
        // OpenAI's equivalent of "thinking" — let it reason before answering.
        // Reasoning tokens count against maxTokens, so leave headroom.
        maxTokens: 4000,
        reasoningEffort: "medium",
      })
    );
  }

  if (process.env.MISTRAL_API_KEY) {
    solvers.push(
      new MistralAgent({
        id: "mistral-solver",
        name: "Mistral",
        description: SOLVER_BRIEF,
        apiKey: process.env.MISTRAL_API_KEY,
        model: "mistral-large-latest",
        maxTokens: 1500,
      })
    );
  }

  // Fallback: only one provider available → diversify with Claude personas so
  // the ensemble still has variety to draw on. Diversity here comes from BOTH a
  // different system prompt AND a different temperature (higher = more varied
  // sampling), not just a different model. Any of the three knobs — model,
  // prompt, temperature — gives the judge distinct candidates to work with.
  //
  // Note: these personas deliberately leave thinking OFF — on Claude, extended
  // thinking forces default sampling, so `temperature` would be ignored. We're
  // showcasing temperature-based diversity here, so we pick temperature over
  // thinking. (The judge still thinks; only the candidate generation skips it.)
  if (solvers.length < 2 && process.env.ANTHROPIC_API_KEY) {
    solvers.push(
      new ClaudeAgent({
        id: "claude-creative",
        name: "Claude (lateral)",
        description: `${SOLVER_BRIEF}\nFavor unconventional, creative approaches.`,
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: "claude-sonnet-4-6",
        maxTokens: 1500,
        temperature: 1.0, // crank up randomness for a more divergent candidate
      }),
      new ClaudeAgent({
        id: "claude-fast",
        name: "Claude (pragmatic)",
        description: `${SOLVER_BRIEF}\nFavor the simplest approach that works.`,
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: "claude-haiku-4-5",
        maxTokens: 1500,
        temperature: 0.2, // keep this one focused and deterministic
      })
    );
  }

  return solvers;
}

// ---------------------------------------------------------------------------
// Judge — synthesizes a single best answer from the candidates
// ---------------------------------------------------------------------------

function buildJudge(): BaseAgent {
  // The judge can be any provider; Claude is used here when available.
  if (process.env.ANTHROPIC_API_KEY) {
    return new ClaudeAgent({
      id: "judge",
      name: "Judge",
      description: `You are an impartial judge comparing candidate solutions to a problem.
Evaluate each for correctness, completeness, and clarity.
Do not merely pick one — synthesize the single best possible answer by combining
the strongest parts of each candidate and fixing any mistakes you notice.
Output only the final synthesized solution.`,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-sonnet-4-6",
      // The judge benefits most from thinking: comparing candidates and merging
      // their strengths is a reasoning-heavy task, and it's a single agent so
      // there's no diversity tradeoff to worry about.
      maxTokens: 4000,
      thinkingBudgetTokens: 2000,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAiAgent({
      id: "judge",
      name: "Judge",
      description: "Synthesize the single best solution from the candidates.",
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
      maxTokens: 2000,
    });
  }
  throw new Error("Set ANTHROPIC_API_KEY or OPENAI_API_KEY for the judge.");
}

// ---------------------------------------------------------------------------
// Compose the ensemble as a single graph and run it
// ---------------------------------------------------------------------------

async function solve(problem: string): Promise<void> {
  const solvers = buildSolvers();
  if (solvers.length === 0) {
    throw new Error("No provider API keys found. Set ANTHROPIC_API_KEY etc.");
  }
  const judge = buildJudge();

  console.log(
    `\nProblem:\n  ${problem}\n\nGenerating ${solvers.length} candidate(s) from: ` +
      solvers.map((s) => s.name).join(", ") +
      "\n"
  );

  // parallel(...) → string[]    transform → VotingInput    voting(judge) → string
  const ensemble = AgentGraph.pipeline<string, string>(
    AgentGraph.parallel({}, ...solvers),
    {
      name: "to-voting-input",
      nodeType: "custom",
      execute: async (solutions: string[]): Promise<VotingInput> => {
        // Surface each candidate before the judge weighs in.
        solutions.forEach((s, i) => {
          console.log(`--- Candidate ${i + 1} (${solvers[i]?.name}) ---`);
          console.log(s.trim().slice(0, 600));
          console.log(s.length > 600 ? "  …(truncated)\n" : "\n");
        });
        return { originalInput: problem, solutions };
      },
    },
    AgentGraph.votingSystem(judge)
  );

  const answer = await ensemble.execute(problem);

  console.log("=== Synthesized answer (judge) ===\n");
  console.log(answer);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const problem =
  process.argv.slice(2).join(" ") ||
  "Write a TypeScript function `chunk<T>(arr: T[], size: number): T[][]` that " +
    "splits an array into chunks of the given size, with edge cases handled. " +
    "Include a one-line explanation.";

solve(problem).catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
