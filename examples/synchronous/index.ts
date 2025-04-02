import "dotenv/config";
import { OpenAiAgent } from "../../lib/agents/openai/OpenAiAgent";
import { AgentGraph } from "../../lib/graph/AgentGraph";
import { AgentEvent } from "../../lib/agents/AgentEvent";
export const agent1 = new OpenAiAgent({
  id: "medical-research",
  name: "Deep thinker agent",
  description: `You write code for a problem that the user has`,
  tools: [],
  apiKey: process.env.OPENAI_API_KEY as string,
  temperature: 1,
  model: "gpt-4o-mini",
  maxTokens: 8000,
});

export const agent2 = new OpenAiAgent({
  id: "medical-research",
  name: "Deep feedback agent",
  description: `You review code and write tests. Return both the code and the tests.`,
  tools: [],
  apiKey: process.env.OPENAI_API_KEY as string,
  model: "gpt-4o-mini",
  temperature: 0,
  maxTokens: 8000,
});

const graph = AgentGraph.synchronous(agent1, agent2);

agent1.on(AgentEvent.AFTER_EXECUTE, (event: AgentEvent) => {
  console.log(JSON.stringify(event, undefined, "  "));
});
agent2.on(AgentEvent.AFTER_EXECUTE, (event: AgentEvent) => {
  console.log(JSON.stringify(event, null, "  "));
});

function run() {
  graph
    .execute(
      `Write a TS class that supports Agents working together in a graph.
      An initial execute command will add to the input of the first agent the choice of connected agents.
      interface Agent{
      execute(input:string):Promise<string>
      }
      `
    )
    .then(console.log);
}
run();
