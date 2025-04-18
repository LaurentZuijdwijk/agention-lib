import { BaseAgent } from "../../agents/BaseAgent";
import { AgentGraph } from "../AgentGraph";

const researchAgent = new BaseAgent();
const factCheckAgent = new BaseAgent();
const summaryAgent = new BaseAgent();
const formatAgent = new BaseAgent();
const deepAnalysisAgent = new BaseAgent();
const criticAgent = new BaseAgent();
const judgeAgent = new BaseAgent();
// Create a branching graph structure
const initialResearch = AgentGraph.sequential(researchAgent, factCheckAgent);

// Branch 1: Summarize
const summarizeBranch = AgentGraph.sequential(summaryAgent, formatAgent);

// Branch 2: Analyze deeply
const analyzeBranch = AgentGraph.sequential(deepAnalysisAgent, criticAgent);

// Combine branches with parallel execution and voting
const graph = AgentGraph.pipeline(
  initialResearch,
  // Create parallel branches
  {
    execute: async (input: string) => {
      const summary = await summarizeBranch.execute(input);
      const analysis = await analyzeBranch.execute(input);
      return [summary, analysis];
    },
  },
  // Vote on the results
  {
    execute: async (results: string[]) => ({
      originalInput: "Analyze the economic impact of AI",
      solutions: results,
    }),
  },
  AgentGraph.votingSystem(judgeAgent)
);

const finalResult = await graph.execute("Analyze the economic impact of AI");
