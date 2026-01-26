/**
 * Reasoning with Sub-Agent Example
 *
 * This example demonstrates using an agent as a reasoning assistant for another agent.
 * A focused "reasoner" agent breaks down complex questions and analyzes them step-by-step,
 * while a main agent coordinates and provides the final synthesized answer.
 *
 * Architecture:
 *   Main Agent (coordinator, no specialized tools)
 *     └── Reasoner Agent (specialized in analytical thinking and problem decomposition)
 */

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { MistralAgent } from "../lib/agents/mistral/MistralAgent";
import { BaseAgent } from "../lib/agents/BaseAgent";
import { Tool } from "../lib/tools/Tool";
import { AgentEvent } from "../lib/agents/AgentEvent";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// =============================================================================
// Reasoning Tools (used by the reasoner sub-agent)
// =============================================================================

const decomposeQuestionTool = new Tool({
  name: "decompose_question",
  description: `Break down a complex question into smaller, manageable sub-questions.
Returns a list of sub-questions that need to be answered to fully address the main question.`,
  inputSchema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The complex question to decompose",
      },
    },
    required: ["question"],
  },
  execute: async (input: { question: string }): Promise<unknown> => {
    // This is a simulated tool - in a real system, this might use LLM or rules
    return {
      originalQuestion: input.question,
      subQuestions: [
        `What are the key concepts involved in: "${input.question}"?`,
        `What assumptions are being made in: "${input.question}"?`,
        `What are the possible approaches to answer: "${input.question}"?`,
      ],
      timestamp: new Date().toISOString(),
    };
  },
});

const analyzeAssumptionsTool = new Tool({
  name: "analyze_assumptions",
  description: `Identify and analyze the assumptions underlying a question or statement.
Returns a list of implicit and explicit assumptions that should be considered.`,
  inputSchema: {
    type: "object",
    properties: {
      statement: {
        type: "string",
        description: "The statement or question to analyze for assumptions",
      },
    },
    required: ["statement"],
  },
  execute: async (input: { statement: string }): Promise<unknown> => {
    return {
      analyzedStatement: input.statement,
      assumptions: {
        implicit: [
          "The question has a definitive answer",
          "Current information is complete and accurate",
        ],
        explicit: ["The context provided is sufficient"],
        needsValidation: ["Check if all terms are clearly defined"],
      },
      timestamp: new Date().toISOString(),
    };
  },
});

const evaluateLogicTool = new Tool({
  name: "evaluate_logic",
  description: `Evaluate the logical structure of an argument or reasoning chain.
Returns an analysis of logical validity, potential fallacies, and strength of reasoning.`,
  inputSchema: {
    type: "object",
    properties: {
      argument: {
        type: "string",
        description: "The argument or reasoning to evaluate",
      },
      context: {
        type: "string",
        description: "Additional context for the argument (optional)",
      },
    },
    required: ["argument"],
  },
  execute: async (input: {
    argument: string;
    context?: string;
  }): Promise<unknown> => {
    return {
      argument: input.argument,
      context: input.context || "No additional context provided",
      logicalStructure: {
        isValid: true,
        strength: "moderate",
        potentialFallacies: [],
        recommendations: [
          "Consider alternative perspectives",
          "Verify factual claims",
        ],
      },
      timestamp: new Date().toISOString(),
    };
  },
});

// =============================================================================
// Sub-Agent Creation (the analytical reasoner)
// =============================================================================

const REASONER_DESCRIPTION = `You are an analytical reasoning specialist. Your job is to:
1. Break down complex questions into manageable parts
2. Identify assumptions and logical structures
3. Evaluate different perspectives and approaches
4. Provide structured analytical insights


Be thorough but concise, you only have 2000 tokens. Focus on clarity and logical rigor in a few lines.`;

function createReasonerAgent(
  provider: "claude" | "openai" | "mistral"
): BaseAgent {
  const config = {
    id: "reasoner",
    name: "Analytical Reasoner",
    description: REASONER_DESCRIPTION,
    tools: [],
    maxTokens: 2048,
  };

  if (provider === "openai") {
    return new OpenAiAgent({
      ...config,
      apiKey: process.env.OPENAI_API_KEY as string,
      model: "gpt-4o-mini", // Fast and cost-effective, no reasoning overhead
      // Note: For reasoning models (gpt-5-nano, o1, etc.), either:
      // - Set disableReasoning: true to disable extended thinking
      // - Or increase maxTokens (e.g., 8192) to accommodate reasoning tokens
    });
  }

  if (provider === "mistral") {
    return new MistralAgent({
      ...config,
      apiKey: process.env.MISTRAL_API_KEY as string,
      model: "mistral-small-latest", // Efficient model for structured reasoning
    });
  }

  return new ClaudeAgent({
    ...config,
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    model: "claude-haiku-4-5", // Fast and efficient for analytical tasks
  });
}

// =============================================================================
// Main Agent Creation (the coordinator)
// =============================================================================

const MAIN_AGENT_DESCRIPTION = `You are a thoughtful assistant that helps users reason through complex questions.
You have access to an analytical reasoner who can break down questions, analyze assumptions, and evaluate logic.

When the user asks a complex question:
1. Use the reasoner to analyze the question thoroughly
2. Synthesize the analysis into a clear, helpful response
3. Provide insights and perspectives that address the core question
4. Acknowledge uncertainty where appropriate

Be clear, thoughtful, and educational. Help the user understand not just the answer, but the reasoning process itself.`;

function createMainAgent(
  provider: "claude" | "openai" | "mistral",
  reasonerTool: Tool<string>
): BaseAgent {
  const config = {
    id: "main",
    name: "Reasoning Assistant",
    description: MAIN_AGENT_DESCRIPTION,
    tools: [reasonerTool],
    maxTokens: 3072,
  };

  if (provider === "openai") {
    return new OpenAiAgent({
      ...config,
      apiKey: process.env.OPENAI_API_KEY as string,
      model: "gpt-4o-mini", // More capable model for synthesis and coordination
    });
  }

  if (provider === "mistral") {
    return new MistralAgent({
      ...config,
      apiKey: process.env.MISTRAL_API_KEY as string,
      model: "mistral-large-latest",
    });
  }

  return new ClaudeAgent({
    ...config,
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    model: "claude-haiku-4-5",
  });
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=== Reasoning Assistant with Sub-Agent ===\n");
  console.log(
    "This example uses a specialized 'reasoner' agent to analyze questions,"
  );
  console.log(
    "while a coordinator agent synthesizes the analysis into helpful responses.\n"
  );

  // Choose provider
  const providerChoice = await rl.question(
    "Which provider? [1] Claude (default), [2] OpenAI, or [3] Mistral: "
  );
  let provider: "claude" | "openai" | "mistral" = "claude";
  if (providerChoice === "2") {
    provider = "openai";
  } else if (providerChoice === "3") {
    provider = "mistral";
  }
  console.log(`Using ${provider}\n`);

  // Create the reasoner sub-agent
  const reasonerAgent = createReasonerAgent(provider);
  console.log(
    "Created reasoner sub-agent (specialized in analytical thinking)"
  );

  // Wrap the reasoner agent as a tool
  const reasonerTool = Tool.fromAgent(
    reasonerAgent,
    `Use this analytical reasoner to break down complex questions, identify assumptions, and evaluate logic.
Provide the question or problem you want analyzed, and it will return structured analytical insights.`
  );
  console.log("Wrapped reasoner as a tool for the main agent");

  // Create the main agent with the reasoner tool
  const mainAgent = createMainAgent(provider, reasonerTool);
  console.log("Created main agent (coordinator for synthesis)\n");

  // Interactive loop for questions
  console.log(
    "Ask me any complex question and I'll reason through it with you."
  );
  console.log("Type 'quit' or 'exit' to end the conversation.\n");

  while (true) {
    const question = await rl.question("> ");

    if (
      question.toLowerCase() === "quit" ||
      question.toLowerCase() === "exit"
    ) {
      console.log("\nGoodbye!");
      break;
    }

    if (!question.trim()) {
      continue;
    }

    console.log("\n--- Reasoning Process ---");

    try {
      reasonerAgent.on(AgentEvent.AFTER_EXECUTE, console.log);
      reasonerAgent.on(AgentEvent.BEFORE_EXECUTE, console.log);
      const result = await mainAgent.execute(question);

      console.log("\n--- Response ---");
      console.log(result);
      console.log("\n");
    } catch (error) {
      console.error("Error:", error);
    }
  }

  rl.close();
  process.exit(0);
}

main().catch(console.error);
