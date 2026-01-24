import "dotenv/config";

import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { Tool, ToolEvent } from "../lib/tools/Tool";
import { readFile, readdir } from "fs/promises";

// Import chunking demo
import "./chunking-demo";

// const config =
// const agent = new ClaudeAgent();

// Example usage
async function exampleAgents() {
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
            "String to search for. An empty string or only 1 character will return an empty result. 2 characters will only match exact matching locations. 3 and more characters will perform fuzzy matching. The search string can be a location name or a postal code.",
        },
      },
      required: ["term"],
    },
    execute: async (input): Promise<any> => {
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
      console.log(
        "weather tool input",
        input,
        `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.long}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m`
      );
      return await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.long}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m`
      ).then((res) => res.json());
    },
  });

  const directoryReadTool = new Tool({
    name: "directoryReadTool",
    description: `This tool can list the files in a local directory.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "relative path, the default should be .",
        },
      },
      required: ["path"],
    },
    execute: async (input): Promise<any> => {
      console.log("directoryReadTool", input);
      return await readdir(__dirname + "/../" + input.path, {
        recursive: true,
      });
    },
  });

  const fileReadTool = new Tool({
    name: "fileReadTool",
    description: `This tool can list the files in a local directory, you should not ask to read file that can contain private info lime .env files.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "relative path of a file",
        },
      },
      required: ["path"],
    },
    execute: async (input): Promise<any> => {
      console.log("fileReadTool", input);
      return await readFile(__dirname + "/../" + input.path, {
        encoding: "utf8",
      });
    },
  });

  const agent = new ClaudeAgent({
    id: "1",
    description:
      "This agent gets the weather for a specific location, it is sarcastic and to the point and tries to make me laugh",
    name: "Funny sarcastic weather agent",
    model: "claude-3-5-haiku-latest",
    tools: [geoCodingTool, weatherTool],
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    // Optional: Force tool usage
    // toolChoice: { type: "any" },
    // Optional: Disable parallel tool use
    disableParallelToolUse: false,
  });

  const agent2 = new ClaudeAgent({
    id: "1",
    description:
      "This helps with software projects, it takes commands, reads files and suggests improvements",
    name: "Powerfull AI coder",
    model: "claude-3-5-haiku-latest",
    tools: [directoryReadTool, fileReadTool],
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    // Optional: Force tool usage
    // toolChoice: { type: "any" },
    // Optional: Disable parallel tool use
    disableParallelToolUse: false,
  });

  const openaiAgent = new OpenAiAgent({
    id: "1",
    description:
      "This helps with software projects, it takes commands, reads files and suggests improvements",
    name: "Powerfull AI coder",
    model: "gpt-4o-mini",
    // tools: [directoryReadTool, fileReadTool],
    apiKey: process.env.OPENAI_API_KEY as string,
    // Optional: Force tool usage
    // toolChoice: { type: "any" },
    // Optional: Disable parallel tool use
    disableParallelToolUse: false,
  });

  try {
    // const result = await agent.execute(
    //   "find the waether forcast for Benidorm and tell me something interesting about it"
    // );
    //
    //
    directoryReadTool.on(ToolEvent.EXECUTE, (event) => {
      console.log("directoryReadTool execution:", event);
    });
    agent;
    agent2;
    openaiAgent;
    const result = await agent2.execute(
      "Complete the tests for ./lib/agents/CommonAgents.spec.ts"
    );

    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Uncomment to run agent examples
// exampleAgents();
