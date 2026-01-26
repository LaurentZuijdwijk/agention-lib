/**
 * Weather Agent Example
 *
 * Demonstrates a multi-provider weather agent that:
 * - Uses geocoding to find locations
 * - Fetches weather data from Open-Meteo API
 * - Supports Claude, OpenAI, Mistral, and Gemini
 * - Includes proper error handling, type safety, and validation
 */

import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { MistralAgent } from "../lib/agents/mistral/MistralAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { GeminiAgent } from "../lib";
import { Tool } from "../lib/tools/Tool";
import { createInterface } from "node:readline/promises";
import { BaseAgent } from "../lib/agents/BaseAgent";

// =============================================================================
// Type Definitions
// =============================================================================

interface GeocodingInput {
  term: string;
}

interface Location {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  timezone: string;
  elevation?: number;
  feature_code?: string;
  population?: number;
  postcodes?: string[];
}

interface GeocodingResult {
  results?: Location[];
  generationtime_ms?: number;
}

interface WeatherInput {
  lat: number;
  long: number;
}

interface CurrentWeather {
  temperature_2m: number;
  wind_speed_10m: number;
  time: string;
}

interface HourlyWeather {
  temperature_2m: number[];
  relative_humidity_2m: number[];
  time: string[];
}

interface WeatherResult {
  current: CurrentWeather;
  current_units: {
    temperature_2m: string;
    wind_speed_10m: string;
  };
  hourly: HourlyWeather;
  hourly_units: {
    temperature_2m: string;
    relative_humidity_2m: string;
  };
  latitude: number;
  longitude: number;
  timezone: string;
}

type Provider = "claude" | "openai" | "mistral" | "gemini";

// =============================================================================
// Tools with Proper Type Safety and Error Handling
// =============================================================================

const geoCodingTool = new Tool({
  name: "geocodingTool",
  description: `This tool accepts a search term and returns a list of matching locations.
Returns an array of results including city name, latitude, longitude, elevation, feature_code, country_code, timezone, population, and postcodes.`,
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
  execute: async (input: GeocodingInput): Promise<GeocodingResult> => {
    try {
      if (!input.term || input.term.trim().length === 0) {
        throw new Error("Search term cannot be empty");
      }

      // Encode URL parameter to prevent injection
      const encodedTerm = encodeURIComponent(input.term.trim());
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodedTerm}&count=10&language=en&format=json`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Geocoding API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as GeocodingResult;

      // Return empty results if no locations found
      if (!data.results || data.results.length === 0) {
        return { results: [] };
      }

      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to geocode location: ${errorMessage}`);
    }
  },
});

const weatherTool = new Tool({
  name: "weatherTool",
  description: `This tool accepts latitude and longitude coordinates and returns the current weather forecast for the location.`,
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
  execute: async (input: WeatherInput): Promise<WeatherResult> => {
    try {
      // Validate coordinates
      if (input.lat < -90 || input.lat > 90) {
        throw new Error("Latitude must be between -90 and 90");
      }
      if (input.long < -180 || input.long > 180) {
        throw new Error("Longitude must be between -180 and 180");
      }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.long}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Weather API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as WeatherResult;
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to fetch weather data: ${errorMessage}`);
    }
  },
});

const tools = [geoCodingTool, weatherTool];

// =============================================================================
// Agent Configuration
// =============================================================================

const AGENT_DESCRIPTION = `You are an agent that gets the weather for a specific location. You are concise and to the point.
Do NOT ask follow up questions, but end the conversation. Format the output as JSON in the following format:
<tooluse>List the tools used</tooluse>
<result>{
  textContent: textual description of the weather,
  currentTempinC: Number,
  currentWind: Number,
  currentPrecip: 'None' | 'light' | 'heavy'
}</result>`;

/**
 * Create the agent based on provider choice
 */
function createAgent(provider: Provider): BaseAgent {
  const commonConfig = {
    id: "weather-agent",
    name: "Weather Agent",
    description: AGENT_DESCRIPTION,
    tools,
  };

  switch (provider) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }
      return new OpenAiAgent({
        ...commonConfig,
        model: "gpt-4o-mini",
        apiKey,
      });
    }

    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
      }
      return new GeminiAgent({
        ...commonConfig,
        model: "gemini-flash-lite-latest",
        apiKey,
      });
    }

    case "mistral": {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new Error("MISTRAL_API_KEY environment variable is not set");
      }
      return new MistralAgent({
        ...commonConfig,
        model: "ministral-3b-latest",
        apiKey,
        disableParallelToolUse: false,
      });
    }

    case "claude":
    default: {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }
      return new ClaudeAgent({
        ...commonConfig,
        model: "claude-haiku-4-5",
        apiKey,
      });
    }
  }
}

/**
 * Validate user input for location
 */
function validateLocationInput(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Location cannot be empty");
  }

  if (trimmed.length < 2) {
    throw new Error("Location must be at least 2 characters");
  }

  // Basic sanitization - remove potentially dangerous characters
  const sanitized = trimmed.replace(/[<>]/g, "");

  return sanitized;
}

/**
 * Parse provider choice from user input
 */
function parseProviderChoice(choice: string): Provider {
  const trimmed = choice.trim();

  switch (trimmed) {
    case "2":
      return "openai";
    case "3":
      return "mistral";
    case "4":
      return "gemini";
    case "1":
    case "":
    default:
      return "claude";
  }
}

// =============================================================================
// Main Function
// =============================================================================

async function getWeatherExample(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("=== Weather Agent Example ===\n");

    // Choose provider
    const providerChoice = await rl.question(
      "Which provider? [1] Claude (default), [2] OpenAI, [3] Mistral, [4] Gemini: "
    );
    const provider = parseProviderChoice(providerChoice);

    console.log(`Using ${provider}\n`);

    // Create agent
    let agent: BaseAgent;
    try {
      agent = createAgent(provider);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to create agent: ${errorMessage}`);
      console.error(
        "Please ensure the appropriate API key is set in your .env file"
      );
      rl.close();
      process.exit(1);
    }

    // Get location from user
    const locationInput = await rl.question(
      "For what location do you want to know the weather?\n> "
    );

    let location: string;
    try {
      location = validateLocationInput(locationInput);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Invalid input";
      console.error(`Input validation error: ${errorMessage}`);
      rl.close();
      process.exit(1);
    }

    // Execute agent
    console.log("\nFetching weather data...\n");

    const result = await agent.execute(
      `Find the weather forecast for ${location}. Format the answer in the correct way. Give some advice about the weather as well. If the location isn't obvious, make an informed guess.`
    );

    console.log("\n=== Weather Forecast ===\n");
    console.log(result);

    // Display token usage if available (without exposing sensitive data)
    const tokenUsage = (agent as { lastTokenUsage?: unknown }).lastTokenUsage;
    if (tokenUsage) {
      console.log(`\n--- Model: ${agent.getModel()} ---`);
      console.log("Token usage:", JSON.stringify(tokenUsage, null, 2));
    }

    rl.close();
    process.exit(0);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("\n=== Error ===");
    console.error(errorMessage);

    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    rl.close();
    process.exit(1);
  }
}

// Run the example
getWeatherExample();
