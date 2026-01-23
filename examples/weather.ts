import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { MistralAgent } from "../lib/agents/mistral/MistralAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { Tool } from "../lib/tools/Tool";

import { createInterface } from "node:readline/promises";
import { BaseAgent } from "../lib/agents/BaseAgent";

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

const tools = [geoCodingTool, weatherTool];

const AGENT_DESCRIPTION = `You are an agent that gets the weather for a specific location. You are concise and to the point.
Do NOT ask follow up questions, but end the conversation. Format the output as JSON in the following format:
<tooluse>List the tools used</tooluse>
<result>{
  textContent: textual description of the weather,
  currentTempinC: Number,
  currentWind: Number,
  currentPrecip: 'None' | 'light' | 'heavy'
}</result>
`;

/**
 * Create the agent based on provider choice
 */
function createAgent(provider: "claude" | "openai" | "mistral"): BaseAgent {
  if (provider === "openai") {
    return new OpenAiAgent({
      id: "1",
      name: "Weather agent",
      description: AGENT_DESCRIPTION,
      apiKey: process.env.OPENAI_API_KEY as string,
      tools,
    });
  }

  if (provider === "mistral") {
    return new MistralAgent({
      id: "1",
      name: "Weather agent",
      description: AGENT_DESCRIPTION,
      apiKey: process.env.MISTRAL_API_KEY as string,
      tools,
      disableParallelToolUse: false,
    });
  }

  return new ClaudeAgent({
    id: "1",
    name: "Weather agent",
    description: AGENT_DESCRIPTION,
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    tools,
  });
}
async function getWeatherExample() {
  try {
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
    console.log(`Using ${provider}`);

    // Create agent
    const agent = createAgent(provider);

    const answer = await rl.question(
      "For what town do you want to know the weather?\n"
    );

    const result = await agent.execute(
      `Find the weather forecast for ${answer}. Format the answer in the correct way.
      Give some advice about the weather as well. If the location isn't obvious, make an informed guess`
    );
    console.log(result);
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    rl.close();
    process.exit(1);
  }
}

getWeatherExample();
