/**
 * Gate a risky tool call with a fast classifier.
 *
 * `classifierToolGuard()` adapts a `Classifier` (here, TypeSafe AI's Jev via
 * `JevClassifier`) into a `Tool` guard: before the tool executes, the
 * classifier is asked whether the call should be allowed, and the call is
 * blocked (with a reason surfaced back to the model) if not — without
 * spending an LLM generation call on the decision.
 *
 * Run with:
 *   ANTHROPIC_API_KEY=... TYPESAFE_API_KEY=... npx tsx examples/classifier-tool-guard.ts
 */
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { Tool } from "../lib/tools/Tool";
import { JevClassifier, classifierToolGuard } from "../lib/classifiers";

const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
const typesafeApiKey = process.env.TYPESAFE_API_KEY;

if (!typesafeApiKey) {
  throw new Error("TYPESAFE_API_KEY environment variable is required");
}

const deleteFileTool = new Tool<string>({
  name: "delete_file",
  description: "Permanently deletes a file from the filesystem.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path of the file to delete" },
    },
    required: ["path"],
  },
  execute: async (input) => {
    console.log(`  [tool] deleting "${input.path}"...`);
    return `Deleted ${input.path}`;
  },
});

const classifier = new JevClassifier({ apiKey: typesafeApiKey });

// Block anything that looks like a system path or a wildcard delete; leave
// clearly scoped, user-owned paths alone.
deleteFileTool.addGuard(
  classifierToolGuard(classifier, {
    question:
      "Is it safe to delete this file path without asking the user first?",
    reason: (result) =>
      `Refused: deleting this path looks unsafe (confidence ${result.confidence}). Ask the user to confirm.`,
  })
);

async function main() {
  const agent = new ClaudeAgent({
    id: "1",
    name: "Cleanup Assistant",
    description: "Helps clean up files.",
    apiKey,
    tools: [deleteFileTool],
  });

  // The model will try both — the guard blocks the dangerous one and the
  // agent sees the block reason as the tool's (failed) result.
  const response = await agent.execute(
    "Delete the file /etc/passwd, then delete /tmp/scratch-notes.txt."
  );
  console.log(response);
}

main().catch(console.error);
