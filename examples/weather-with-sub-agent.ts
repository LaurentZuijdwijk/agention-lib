/**
 * Weather with Sub-Agent Example
 *
 * This example demonstrates using an agent as a tool for another agent.
 * A cheap "weatherman" agent handles the tool calls (geocoding + weather API),
 * while a main agent coordinates and provides the final response.
 *
 * Architecture:
 *   Main Agent (expensive model, no tools)
 *     └── Weatherman Agent (cheap model, has geocoding + weather tools)
 */

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { MistralAgent } from "../lib/agents/mistral/MistralAgent";
import { OllamaAgent } from "../lib/agents/ollama/OllamaAgent";
import { BaseAgent } from "../lib/agents/BaseAgent";
import { Tool } from "../lib/tools/Tool";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// =============================================================================
// Weather Tools (used by the weatherman sub-agent)
// =============================================================================

const geoCodingTool = new Tool({
  name: "geocoding",
  description: `Look up coordinates for a location. Returns city name, latitude, longitude, country, and timezone.`,
  inputSchema: {
    type: "object",
    properties: {
      term: {
        type: "string",
        description: "Location name to search for (city, town, etc.)",
      },
    },
    required: ["term"],
  },
  execute: async (input: { term: string }): Promise<unknown> => {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        input.term
      )}&count=3&language=en&format=json`
    ).then((res) => res.json());

    if (!res.results || res.results.length === 0) {
      return { error: `No location found for "${input.term}"` };
    }

    return {
      locations: res.results.map((r: Record<string, unknown>) => ({
        name: r.name,
        country: r.country,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
      })),
    };
  },
});

const weatherTool = new Tool({
  name: "weather",
  description: `Get current weather for a location using latitude and longitude coordinates.`,
  inputSchema: {
    type: "object",
    properties: {
      lat: {
        type: "number",
        description: "Latitude",
      },
      long: {
        type: "number",
        description: "Longitude",
      },
    },
    required: ["lat", "long"],
  },
  execute: async (input: { lat: number; long: number }): Promise<unknown> => {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.long}&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    ).then((res) => res.json());

    return {
      current: {
        temperature: res.current?.temperature_2m,
        unit: res.current_units?.temperature_2m,
        windSpeed: res.current?.wind_speed_10m,
        windUnit: res.current_units?.wind_speed_10m,
      },
      daily: res.daily
        ? {
            dates: res.daily.time?.slice(0, 3),
            maxTemps: res.daily.temperature_2m_max?.slice(0, 3),
            minTemps: res.daily.temperature_2m_min?.slice(0, 3),
          }
        : null,
    };
  },
});

// =============================================================================
// Sub-Agent Creation (the cheap weatherman)
// =============================================================================

const WEATHERMAN_DESCRIPTION = `You are a weather data retrieval specialist. Your job is to:
1. Use the geocoding tool to find coordinates for the requested location
2. Use the weather tool to get the current weather data
3. Return the raw weather data in a structured format

Be efficient and only make the necessary tool calls. Return the data concisely.`;

function createWeathermanAgent(
  provider: "claude" | "openai" | "mistral" | "ollama"
): BaseAgent {
  const config = {
    id: "weatherman",
    name: "Weatherman",
    description: WEATHERMAN_DESCRIPTION,
    tools: [geoCodingTool, weatherTool],
    maxTokens: 1024,
  };

  if (provider === "openai") {
    return new OpenAiAgent({
      ...config,
      apiKey: process.env.OPENAI_API_KEY as string,
      model: "gpt-4o-mini", // Cheap model for tool calls
    });
  }

  if (provider === "mistral") {
    return new MistralAgent({
      ...config,
      apiKey: process.env.MISTRAL_API_KEY as string,
    });
  }
  if (provider === "ollama") {
    return new OllamaAgent({
      ...config,
      apiKey: "",
      model: "gemma4:e4b",
      think: false,
    });
  }
  return new ClaudeAgent({
    ...config,
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    model: "claude-haiku-4-5", // Cheap model for tool calls
  });
}

// =============================================================================
// Main Agent Creation (the coordinator)
// =============================================================================

const MAIN_AGENT_DESCRIPTION = `You are a helpful weather assistant. You have access to a weatherman assistant who can fetch weather data for any location.

When the user asks about weather:
1. Ask the weatherman to get the weather data
2. Interpret the data and provide a helpful, conversational response
3. Include practical advice based on the weather conditions

Be friendly and helpful. Add interesting observations about the weather when appropriate.`;

function createMainAgent(
  provider: "claude" | "openai" | "mistral" | "ollama",
  weathermanTool: Tool<string>
): BaseAgent {
  const config = {
    id: "main",
    name: "Weather Assistant",
    description: MAIN_AGENT_DESCRIPTION,
    tools: [weathermanTool],
    maxTokens: 2048,
  };

  if (provider === "openai") {
    return new OpenAiAgent({
      ...config,
      apiKey: process.env.OPENAI_API_KEY as string,
      model: "gpt-4o", // More capable model for the main agent
    });
  }

  if (provider === "mistral") {
    return new MistralAgent({
      ...config,
      apiKey: process.env.MISTRAL_API_KEY as string,
      model: "mistral-large-latest",
    });
  }
  if (provider === "ollama") {
    return new OllamaAgent({
      ...config,
      apiKey: "",
      model: "gemma4:e4b",
      think: false,
    });
  }
  return new ClaudeAgent({
    ...config,
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    model: "claude-sonnet-4-5", // More capable model for the main agent
  });
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=== Weather Assistant with Sub-Agent ===\n");
  console.log(
    "This example uses a cheap 'weatherman' agent to handle API calls,"
  );
  console.log("while a smarter main agent provides the final response.\n");

  // Choose provider
  const providerChoice = await rl.question(
    "Which provider? [1] Claude (default), [2] OpenAI, or [3] Mistral or [4] Ollama: "
  );
  let provider: "claude" | "openai" | "mistral" | "ollama" = "claude";
  if (providerChoice === "2") {
    provider = "openai";
  } else if (providerChoice === "3") {
    provider = "mistral";
  } else if (providerChoice === "4") {
    provider = "ollama";
  }
  console.log(`Using ${provider}\n`);

  // Create the weatherman sub-agent
  const weathermanAgent = createWeathermanAgent(provider);
  console.log("Created weatherman sub-agent (cheap model for tool calls)");

  // Wrap the weatherman agent as a tool
  const weathermanTool = Tool.fromAgent(
    weathermanAgent,
    "Use this assistant to get weather data for any location. Provide the location name and it will return current weather conditions and a 3-day forecast."
  );
  console.log("Wrapped weatherman as a tool for the main agent");

  // Create the main agent with the weatherman tool
  const mainAgent = createMainAgent(provider, weathermanTool);
  console.log("Created main agent (smarter model for responses)\n");

  // Get weather query from user
  const location = await rl.question(
    "For what location do you want to know the weather?\n> "
  );

  console.log("\nProcessing your request...\n");
  console.log("--- Agent Activity ---");

  try {
    const result = await mainAgent.execute(
      `What's the weather like in ${location}? Please provide current conditions and any advice for the day.`
    );

    console.log("\n--- Response ---");
    console.log(result);
  } catch (error) {
    console.error("Error:", error);
  }

  rl.close();
  process.exit(0);
}

main().catch(console.error);
