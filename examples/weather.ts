import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
// import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { Tool } from "../lib/tools/Tool";

import { createInterface } from "node:readline/promises";
import { Agent } from "../lib/agents/Agent";
import { AgentEvent } from "../lib/agents/AgentEvent";
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const geoCodingTool = new Tool({
  name: "geocodingTool",
  description: `This tool accepts a search term and returns a list of matching locations.
  returns an array of results include city name, latitude, longitude, elevation, feature_code, country_code, timezone, population, postcodes`,
  inputSchema: {
    type: "object",
    properties: {
      term: {
        type: "string",
        description:
          "String to search for. An empty string or only 1 character will return an empty result. 2 characters will only match exact matching locations. 3 and more characters will perform fuzzy matching. The search string can be a location name or a postal code, should NOT contain a country or state code.",
      },
    },
    required: ["term"],
  },
  execute: async (input: { term: string }): Promise<any> => {
    input;
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${input.term}&count=10&language=en&format=json`
    ).then(async (res) => await res.json());
    return res;
  },
});

const weatherTool = new Tool({
  name: "weatherTool",
  description: `This tool accepts a lat/long code and returns the weather forecast for the location.`,
  inputSchema: {
    type: "object",
    properties: {
      lat: {
        type: "number",
        description: "Latitude for the location.",
      },
      long: {
        type: "number",
        description: "Longitude for the location.",
      },
    },
    required: ["lat", "long"],
  },
  execute: async (input): Promise<any> => {
    return await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.long}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m`
    ).then((res) => res.json());
  },
});

const weatherAgent = new ClaudeAgent({
  id: "1",
  description: `You are an agent that gets the weather for a specific location, You are consice and to the point.
    Do NOT ask follow up questions, but end the conversation. Format the output as JSON in the following format:
    <tooluse>List the tools used<tooluse>
    <result>{
      textContent: textual description of the weather,
      currentTempinC: Number,
      currentWind: Number,
      currentPrecip: 'None' | 'light' | 'heavy'
    }</result>
    `,
  name: "Weather agent",
  tools: [geoCodingTool, weatherTool],
  apiKey: process.env.ANTHROPIC_API_KEY as string,
  disableParallelToolUse: false,
});
const openAiAgent = Agent.create({
  id: "1",
  description: `You are an agent that gets the weather for a specific location, You are consice and to the point.
Do NOT ask follow up questions, but end the conversation. Format the output as JSON in the following format:
<tooluse>List the tools used<tooluse>
<result>{
text: textual description of the weather,
currentTempinC: Number,
currentWind: Number,
currentPrecip: 'None' | 'light' | 'heavy'
}</result>
`,
  name: "Funny sarcastic weather agent",
  vendor: "openai",
  // model: "claude-3-5-haiku-20241022",
  tools: [geoCodingTool, weatherTool],
  apiKey: process.env.OPENAI_API_KEY as string,
  // Optional: Force tool usage
  // toolChoice: { type: "any" },
  // Optional: Disable parallel tool use
  // disableParallelToolUse: false,
});
async function getWeatherExample() {
  try {
    const answer = await rl.question(
      "For what town do you want to know the weather?\n"
    );
    weatherAgent.addListener(AgentEvent.DONE, (event: AgentEvent) =>
      console.log("done", event.target)
    );
    openAiAgent.addListener(AgentEvent.DONE, (event: AgentEvent) =>
      console.log("done", event)
    );
    openAiAgent.addListener(AgentEvent.AFTER_EXECUTE, (event: AgentEvent) =>
      console.log("AFTER_EXECUTE", event)
    );
    openAiAgent.addListener(AgentEvent.BEFORE_EXECUTE, (event: AgentEvent) =>
      console.log("BEFORE_EXECUTE", event)
    );
    const result = await openAiAgent.execute(
      `Find the weather forcast for ${answer}. Format the answer in the correct way.
      Give some advice about the weather as well. If the location isn't obvious, make an informed guess`
    );
    console.log(result);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
  }
}

getWeatherExample();
