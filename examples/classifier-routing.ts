/**
 * Route a request with a fast classifier instead of an LLM generation call.
 *
 * `RouterExecutor` normally spends a full LLM call to pick a route name from
 * free text. Passing a `Classifier` (here, TypeSafe AI's Jev via
 * `JevClassifier`) instead skips that generation call — and the fuzzy
 * text-parsing that goes with it — since the classifier's answer is already
 * one of the known route names.
 *
 * Run with:
 *   ANTHROPIC_API_KEY=... TYPESAFE_API_KEY=... npx tsx examples/classifier-routing.ts
 */
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { RouterExecutor } from "../lib/graph/RouterExecutor";
import { JevClassifier } from "../lib/classifiers";

const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
const typesafeApiKey = process.env.TYPESAFE_API_KEY;

if (!typesafeApiKey) {
  throw new Error("TYPESAFE_API_KEY environment variable is required");
}

const techAgent = new ClaudeAgent({
  id: "tech",
  name: "Technical Support",
  description: "Answers technical/coding questions.",
  apiKey,
});

const billingAgent = new ClaudeAgent({
  id: "billing",
  name: "Billing Support",
  description: "Answers billing and account questions.",
  apiKey,
});

async function main() {
  const classifier = new JevClassifier({ apiKey: typesafeApiKey });

  const router = new RouterExecutor(classifier, [
    {
      name: "technical",
      description: "Technical questions about code, errors, or how something works",
      handler: techAgent,
    },
    {
      name: "billing",
      description: "Questions about charges, invoices, refunds, or account billing",
      handler: billingAgent,
    },
  ]);

  const result = await router.execute(
    "I was charged twice for my subscription this month, can you help?"
  );
  console.log(result);
}

main().catch(console.error);
