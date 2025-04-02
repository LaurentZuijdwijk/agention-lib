import "dotenv/config";

import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { Tool, ToolEvent } from "../lib/tools/Tool";
import { readFile, readdir, writeFile } from "fs/promises";

import { createInterface } from "node:readline/promises";
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
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
  description: `This tool read a file in a local directory, you should not ask to read file that can contain private info lime .env files.`,
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
const fileWriteTool = new Tool({
  name: "fileWriteTool",
  description: `This tool can be used to write to files. Be careful, it will overwrite existing files with new content. Can be used to create new files as well.`,
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "relative path of a file",
      },
      data: {
        type: "string",
        description: "Content to write to the file",
      },
    },
    required: ["path", "content"],
  },
  execute: async (input: {
    path: string;
    content: string;
  }): Promise<string> => {
    console.log("fileWriteTool", input.path, input.content);
    const answer = await rl.question("Can I write this file? Y/N");
    if (answer === "Y") {
      await writeFile(__dirname + "/../" + input.path, input.content, {});
      return "Success writing to " + input.path;
    } else {
      return "Could not write to " + input.path;
    }
  },
});

async function example() {
  const agent2 = new ClaudeAgent({
    id: "1",
    description:
      "You are a world class software engineer who helps with software projects, you have access to files and directories and can create and write to files.",
    name: "Powerfull AI coder",
    model: "claude-3-5-haiku-latest",
    tools: [directoryReadTool, fileReadTool, fileWriteTool],
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    disableParallelToolUse: false,
    maxTokens: 8000,
  });

  const openaiAgent = new OpenAiAgent({
    id: "1",
    description:
      "This helps with software projects, it takes commands, reads files and suggests improvements",
    name: "Powerfull AI coder",
    model: "gpt-4o-mini",
    // tools: [directoryReadTool, fileReadTool],
    apiKey: process.env.OPENAI_API_KEY as string,
    disableParallelToolUse: false,
  });

  try {
    directoryReadTool.on(ToolEvent.RESULT, () => {
      // console.log("directoryReadTool.on(ToolEvent.EXECUTE", args);
      // args.event.preventDefault();
    });
    agent2;
    openaiAgent;
    const result = await agent2.execute(
      "write jest unit tests for ./lib/agents/openai/OpenAiAgent.ts"
    );

    console.log("final result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

example();
