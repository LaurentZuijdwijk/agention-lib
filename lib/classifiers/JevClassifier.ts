import { isAbortError } from "../agents/cancellation";
import { Classifier, ClassifyOptions, ClassifyRequest, ClassifyResult } from "./Classifier";
import { ClassifierCallError } from "./errors";

/**
 * Configuration for {@link JevClassifier}. Mirrors the flat-config-plus-
 * `vendorConfig` shape used across this library's agents, even though a
 * classifier isn't a `BaseAgent`.
 */
export interface JevClassifierConfig {
  /** Falls back to the `TYPESAFE_API_KEY` environment variable, like the SDK itself. */
  apiKey?: string;
  baseURL?: string;
  /** Passed to the SDK as `defaultModel`. */
  model?: string;
  timeout?: number;
  /** Escape hatch for any `TypeSafeClient` constructor option not covered above. */
  vendorConfig?: { jev?: Record<string, unknown> };
}

/**
 * `Classifier` backed by TypeSafe AI's Jev model via `@typesafe-ai/sdk`
 * (optional peer dependency — install it when using this class):
 * ```
 * npm install @typesafe-ai/sdk
 * ```
 *
 * @example
 * ```typescript
 * const classifier = new JevClassifier({ apiKey: process.env.TYPESAFE_API_KEY });
 * const result = await classifier.classify({
 *   context: { ticket: "I was charged twice. Please fix this ASAP." },
 *   question: "What is this ticket about?",
 *   options: ["billing", "technical", "account"],
 * });
 * console.log(result.choice, result.confidence);
 * ```
 */
export class JevClassifier implements Classifier {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdkClient?: Promise<any>;

  constructor(private config: JevClassifierConfig = {}) {}

  async classify(
    request: ClassifyRequest,
    options?: ClassifyOptions
  ): Promise<ClassifyResult> {
    try {
      // Inside the try so a missing peer dependency or API key surfaces as
      // a ClassifierCallError like any other failure.
      const { client, choice } = await this.getClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questions: any = {
        decision: choice(
          request.question,
          Object.fromEntries(
            request.options.map((option) => [
              option,
              request.optionDescriptions?.[option] ?? null,
            ])
          )
        ),
      };

      const result = await client.systemOne(
        { state: request.context, questions, model: this.config.model },
        { signal: options?.signal, timeout: options?.timeout }
      );

      const answer = result.answers.decision;
      return {
        choice: answer.choice,
        confidence: answer.confidence,
        probabilities: answer.probabilities,
        raw: result,
      };
    } catch (error) {
      // A cancelled classification is not a classifier failure — surface it
      // as-is so callers (e.g. a guard mid-classification when the whole
      // agent run is aborted) can tell it apart from a genuine error.
      if (isAbortError(error, options?.signal)) {
        throw error;
      }
      throw new ClassifierCallError(
        `Jev classification failed: ${(error as Error)?.message ?? error}`,
        error
      );
    }
  }

  /**
   * Lazily loads `@typesafe-ai/sdk` and constructs the client on first use,
   * so importing this module never requires the peer dependency to be
   * installed — only calling {@link classify} does.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getClient(): Promise<any> {
    // Cache the promise, not the result, so concurrent first calls share one
    // client; a failed load is dropped so a later call can retry.
    this.sdkClient ??= this.loadClient().catch((error) => {
      this.sdkClient = undefined;
      throw error;
    });
    return this.sdkClient;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadClient(): Promise<any> {
    // Built at runtime so tsc does not attempt to resolve it at compile time.
    const pkg = "@typesafe-ai/sdk";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { TypeSafeClient, choice } = await import(/* @vite-ignore */ pkg) as any;

    const client = new TypeSafeClient({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      defaultModel: this.config.model,
      timeout: this.config.timeout,
      ...this.config.vendorConfig?.jev,
    });

    return { client, choice };
  }
}
