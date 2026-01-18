/**
 * Agent Definitions for Data Pipeline Example
 */

import { ClaudeAgent } from "../../../lib/agents/anthropic/ClaudeAgent";

/**
 * Creates the agents used in the data pipeline.
 * Requires ANTHROPIC_API_KEY environment variable.
 */
export function createPipelineAgents(apiKey: string) {
  const analyzerAgent = new ClaudeAgent({
    id: "analyzer",
    name: "Data Analyzer",
    description: `You are a data analysis agent. You receive information compiled from multiple sources
(internal databases, external web sources, vector databases, etc.).

Your job is to:
1. Analyze and synthesize the information
2. Note the source of each piece of information
3. Identify any discrepancies between sources
4. Highlight what's most important
5. Flag any gaps in the data

Be objective and factual. If sources conflict, present both perspectives.`,
    apiKey,
    maxTokens: 1024,
  });

  const summarizerAgent = new ClaudeAgent({
    id: "summarizer",
    name: "Executive Summarizer",
    description: `You create concise executive summaries.

Guidelines:
- Maximum 100 words
- Lead with the most important finding
- Use bullet points for key facts
- End with a clear recommendation or next step
- Be direct and actionable`,
    apiKey,
    maxTokens: 256,
  });

  const researchAgent = new ClaudeAgent({
    id: "researcher",
    name: "Research Agent",
    description: `You are a research agent that synthesizes information from multiple data sources.
Given compiled research data, provide a comprehensive but focused analysis.
Structure your output clearly with sections for: Key Facts, Analysis, and Conclusions.`,
    apiKey,
    maxTokens: 1024,
  });

  return {
    analyzerAgent,
    summarizerAgent,
    researchAgent,
  };
}
