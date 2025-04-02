import { Tool, ToolResultEvent } from "../tools/Tool";
import { BaseAgent, BaseAgentConfig } from "../agents/BaseAgent";
import EventEmitter from "node:events";
import { Agent } from "../agents/Agent";

export type TeamConfig = {
  name: string;
  agents: BaseAgent[];
  leadAgent: BaseAgent;
  delegationPrompt?: string;
};

/**
 * A team consists of a number of agents.
 *
 * Todo:
 * [] events from a team for tools and agents.
 * [x] add a team lead agent who delegates work
 * [x] Option for team members to work together. Tool.fomAgent
 * [] add agents purely from text config
 * [] keep track of the number of tokens being used
 */
export class Team extends EventEmitter {
  protected tools: Tool<any>[] = [];
  protected leadAgent: BaseAgent;
  protected agents: BaseAgent[] = [];
  protected delegationPrompt: string;
  protected name: string;

  constructor(config: TeamConfig) {
    super();
    this.leadAgent = config.leadAgent;
    this.agents = config.agents || [];
    this.name = config.name;
    this.delegationPrompt =
      config.delegationPrompt ||
      "You are the team leader. You can delegate tasks to your team members when appropriate. " +
        "Analyze the task and decide whether to handle it yourself or delegate to a team member with the right expertise.";
    this.setupTeam();

    // this.emit("agentsUpdated", [...this.agents]);
    // this.emit("toolsUpdated", [...this.tools]);
    this.tools.forEach((tool) =>
      tool.addListener(ToolResultEvent.RESULT, (...args) => {
        this.emit(ToolResultEvent.RESULT, ...args);
      })
    );
  }

  private get memberAgents(): BaseAgent[] {
    return this.agents.filter(
      (agent) => agent.getId() !== this.leadAgent.getId()
    );
  }

  private setupTeam() {
    // Convert member agents to tools that the lead agent can use
    const memberTools = this.memberAgents.map((agent) =>
      Tool.fromAgent(agent, `Delegate to this team member`)
    );
    this.tools.push(...memberTools);
    this.leadAgent.addTools(memberTools);

    // Add all tools from all agents
    this.agents.forEach((agent) => {
      agent.getTools().forEach((tool) => {
        if (!this.tools.includes(tool)) {
          this.tools.push(tool);
        }
      });
    });

    // Set up event forwarding
    // this.setupEventForwarding();

    // Emit initial events
    this.emit("leadAgentSet", this.leadAgent);
    this.emit("memberAgentsUpdated", [...this.memberAgents]);
    this.emit("toolsUpdated", [...this.tools]);
  }

  addAgent(newAgent: BaseAgent) {
    if (this.agents.find((agent) => agent.getId() === newAgent.getId())) {
      this.agents.push(newAgent);
    }
    this.emit("agentsUpdated", [...this.agents]);
  }

  /**
   * Execute a task with the team by delegating to the lead agent
   * @param input The input for the task
   * @returns The result from the lead agent
   */
  async execute(input: string): Promise<any> {
    // this.emit("teamTaskStarted", { input, teamName: this.name });

    try {
      const result = await this.leadAgent.execute(input);
      // this.emit("teamTaskCompleted", { input, result, teamName: this.name });
      return result;
    } catch (error) {
      // this.emit("teamTaskError", { input, error, teamName: this.name });
      throw error;
    }
  }

  /**
   * Get the lead agent
   */
  getLeadAgent(): BaseAgent {
    return this.leadAgent;
  }

  /**
   * Get all tools available to the team
   */
  getTools(): Tool<any>[] {
    return [...this.tools];
  }
  fromConfig(config: BaseAgentConfig[]) {
    config.forEach((agentConfig) => {
      this.addAgent(Agent.create(agentConfig));
    });
  }
}
