import { BaseAgent } from "../agents/BaseAgent";
import { GraphNode } from "./BaseExecutor";
import { MapExecutor } from "./MapExecuter";
import { ParallelExecutor } from "./ParallelExecutor";
import { Pipeline } from "./Pipeline";
import { SequentialExecutor } from "./SquentialExecutor";
import { VotingSystem } from "./VotingSystem";

/**
 * Main class for building and executing agent graphs
 */
export class AgentGraph {
  static sequential(...agents: BaseAgent[]): SequentialExecutor {
    return new SequentialExecutor(...agents);
  }

  static parallel(options = {}, ...agents: BaseAgent[]): ParallelExecutor {
    return new ParallelExecutor(options, ...agents);
  }

  static votingSystem(judge: BaseAgent, options = {}): VotingSystem {
    return new VotingSystem(judge, options);
  }

  static map(processor: GraphNode): MapExecutor {
    return new MapExecutor(processor);
  }

  static pipeline(...stages: GraphNode[]): Pipeline {
    return new Pipeline(...stages);
  }
}
