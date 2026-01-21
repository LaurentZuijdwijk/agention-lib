/**
 * History Persistence Example
 *
 * This example demonstrates:
 * 1. Loading conversation history from a JSON file
 * 2. Having a conversation with an AI agent that can use tools
 * 3. Saving the history back to the file on exit
 * 4. Tool calls are preserved in history and work across providers
 *
 * The history persists across sessions, so you can continue
 * conversations where you left off.
 */

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { History, HistoryEntry } from "../lib/history/History";
import { BaseAgent } from "../lib/agents/BaseAgent";
import { Tool } from "../lib/tools/Tool";

const HISTORY_FILE = "./history.json";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// =============================================================================
// Tools
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

    // Return simplified results
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

const tools = [geoCodingTool, weatherTool];

// =============================================================================
// History Management
// =============================================================================

/**
 * Load history from JSON file if it exists
 */
async function loadHistory(): Promise<History> {
  if (existsSync(HISTORY_FILE)) {
    try {
      const data = await readFile(HISTORY_FILE, "utf-8");
      const entries = JSON.parse(data) as HistoryEntry[];
      console.log(
        `Loaded ${entries.length} history entries from ${HISTORY_FILE}`
      );
      return new History(entries, { transient: false });
    } catch (error) {
      console.warn(`Could not load history file: ${error}`);
    }
  }
  console.log("Starting with fresh history");
  return new History([], { transient: false });
}

/**
 * Save history to JSON file
 */
async function saveHistory(history: History): Promise<void> {
  try {
    const json = history.toJSON();
    await writeFile(HISTORY_FILE, json, "utf-8");
    console.log(`Saved ${history.length} history entries to ${HISTORY_FILE}`);
  } catch (error) {
    console.error(`Failed to save history: ${error}`);
  }
}

// =============================================================================
// Agent Creation
// =============================================================================

const AGENT_DESCRIPTION = `You are a helpful assistant with access to weather information.
You can look up weather for any location using the geocoding and weather tools.
You remember previous conversations and can reference them when relevant.
Be concise but helpful.`;

/**
 * Create the agent with shared history
 */
function createAgent(
  provider: "claude" | "openai",
  history: History
): BaseAgent {
  if (provider === "openai") {
    return new OpenAiAgent(
      {
        id: "assistant",
        name: "Assistant",
        description: AGENT_DESCRIPTION,
        apiKey: process.env.OPENAI_API_KEY as string,
        model: "gpt-4o-mini",
        maxTokens: 1024,
        tools,
      },
      history
    );
  }

  return new ClaudeAgent(
    {
      id: "assistant",
      name: "Assistant",
      description: AGENT_DESCRIPTION,
      apiKey: process.env.ANTHROPIC_API_KEY as string,
      model: "claude-3-5-haiku-latest",
      maxTokens: 1024,
      tools,
    },
    history
  );
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  // Load existing history
  const history = await loadHistory();

  // Show previous conversation summary if history exists
  if (history.length > 0) {
    console.log("\n--- Previous Conversation Summary ---");
    const entries = history.entries.slice(-6); // Show last 6 entries
    for (const entry of entries) {
      if (entry.role === "system") continue;

      // Show text content
      const textParts = entry.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { text: string }).text);

      // Show tool use summary
      const toolUses = entry.content.filter((c) => c.type === "tool_use");
      const toolResults = entry.content.filter((c) => c.type === "tool_result");

      if (textParts.length > 0) {
        const preview = textParts.join(" ").slice(0, 80);
        console.log(
          `[${entry.role}]: ${preview}${preview.length >= 80 ? "..." : ""}`
        );
      }
      if (toolUses.length > 0) {
        const toolNames = toolUses
          .map((t) => (t as { name: string }).name)
          .join(", ");
        console.log(`[${entry.role}]: 🔧 Used tools: ${toolNames}`);
      }
      if (toolResults.length > 0) {
        console.log(`[${entry.role}]: 📋 Tool results received`);
      }
    }
    console.log("------------------------------------\n");
  }

  // Choose provider
  const providerChoice = await rl.question(
    "Which provider? [1] Claude (default) or [2] OpenAI: "
  );
  const provider = providerChoice === "2" ? "openai" : "claude";
  console.log(`Using ${provider}`);

  // Create agent with the loaded history
  const agent = createAgent(provider, history);

  console.log("\n----- Chat Assistant (with Weather Tools) -----");
  console.log("Your conversation history is preserved between sessions.");
  console.log("Try asking about the weather in different cities!");
  console.log("Commands:");
  console.log("  'exit' - Save and quit");
  console.log("  'clear' - Clear history and start fresh");
  console.log("  'history' - Show conversation history");
  console.log("----------------------------------------------\n");

  let running = true;

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\nSaving history...");
    await saveHistory(history);
    rl.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    const input = await rl.question("\nYou: ");
    const trimmedInput = input.trim().toLowerCase();

    if (trimmedInput === "exit") {
      await shutdown();
      break;
    }

    if (trimmedInput === "clear") {
      history.clear();
      console.log("History cleared. Starting fresh.");
      continue;
    }

    if (trimmedInput === "history") {
      console.log("\n--- Full History ---");
      for (const entry of history.entries) {
        if (entry.role === "system") continue;

        console.log(`\n[${entry.role.toUpperCase()}]:`);

        for (const block of entry.content) {
          if (block.type === "text") {
            console.log((block as { text: string }).text);
          } else if (block.type === "tool_use") {
            const tool = block as { name: string; input: unknown };
            console.log(`🔧 Tool: ${tool.name}`);
            console.log(`   Input: ${JSON.stringify(tool.input)}`);
          } else if (block.type === "tool_result") {
            const result = block as { content: string };
            const preview = result.content.slice(0, 100);
            console.log(
              `📋 Result: ${preview}${result.content.length > 100 ? "..." : ""}`
            );
          }
        }
      }
      console.log("\n--- End History ---");
      continue;
    }

    if (!input.trim()) {
      continue;
    }

    try {
      console.log("\nAssistant: Thinking...");
      const response = await agent.execute(input);
      console.log(`\nAssistant: ${response}`);
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }
}

main().catch(console.error);
