import { BaseAgent } from "../agents/BaseAgent";
import { ParallelExecutor } from "./ParallelExecutor";
import { SquentialExecutor } from "./SquentialExecutor";
import { VotingOptions, VotingSystem } from "./VotingSystem";

// class AgentNode {
//   constructor(private agent: BaseAgent) {}
//   async execute(input: any) {
//     const result = await this.agent.execute(input);
//     // if next then execure next
//     // if not mandatory next then execute the chosen next
//     // else return result.
//   }
// }
// addNext() {}

/**
 * An Edge connects the Nodes in the graph.
 * In a directed graph we can have mandatory steps and optional steps.
 *
 */
// class Edge {
//   public mandatory: boolean;
//   constructor(
//     private from: AgentNode,
//     private to: AgentNode,
//     { mandatory }: { mandatory: boolean }
//   ) {
//     this.mandatory = mandatory;
//     if (!mandatory) {
//       from.addTool(to);
//     } else {
//     }
//   }
// }

/**
 * Construct chains of agents in a directed finite graph that can collaborate to solve problems.
 * - Agents can be from different vendors, for example mix Claude and Grok.
 * - Edges can be optional or mandatory.
 * - Agents can have their own history, or it can be shared
 *
 *
 */
export class AgentGraph {
  // private nodes: Map<string, AgentNode> = new Map();
  // private edges: Map<string, string[]> = new Map(); // Agent connections

  static synchronous(...args: BaseAgent[]) {
    return new SquentialExecutor(...args);
  }
  static parallel(...args: BaseAgent[]) {
    return new ParallelExecutor(...args);
  }
  static votingSystem(judge: BaseAgent, options: VotingOptions = {}) {
    return new VotingSystem(judge, options);
  }
  constructor() {}
  async execute() {}
  // addAgent(agent: BaseAgent, id?: string): string {
  //   const nodeId = id || agent.getId();
  //   this.nodes.set(nodeId, new AgentNode(agent));
  //   return nodeId;
  // }
  // connect(sourceId: string, targetId: string) {
  //   // if (!this.edges.has(sourceId)) {
  //   //   this.edges.set(sourceId, []);
  //   // }
  //   // this.edges.get(sourceId)!.push(targetId);
  // }
}

// example
//
// const graph = new AgentGraph();

// const researchAgent = new ClaudeAgent({...});
// const analysisAgent = new ClaudeAgent({...});
// const summaryAgent = new ClaudeAgent({...});

// graph.addAgent(researchAgent);
// graph.addAgent(analysisAgent);
// graph.addAgent(summaryAgent);

// graph.connect(researchAgent, analysisAgent);
// graph.connect(analysisAgent, summaryAgent);

// // Execute the graph
// const result = await graph.execute("Research quantum computing");// Example usage of AgentGraph
