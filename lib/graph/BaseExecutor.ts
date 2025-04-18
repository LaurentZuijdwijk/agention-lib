import { BaseAgent } from "../agents/BaseAgent";

/**
 * Represents a node in the agent graph that can process inputs and produce outputs
 */
export interface GraphNode {
  execute(input: string | object): Promise<string | string[]>;
}

/**
 * Base class for executors that implement the GraphNode interface
 */
export abstract class BaseExecutor implements GraphNode {
  abstract execute(input: string | object): Promise<string | string[]>;
}
