import {
  GoogleGenerativeAI,
  GenerativeModel,
  FunctionDeclarationsTool,
  FunctionDeclarationSchema,
  SchemaType,
  Part,
  FunctionCall,
  GenerateContentResult,
  Schema,
} from "@google/generative-ai";

import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, toolResult, MessageContent } from "../../history/History";
import { geminiTransformer } from "../../history/transformers";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";
import { GeminiModel } from "../model-types";

type AgentConfig = BaseAgentConfig & {
  apiKey: string;
  model?: GeminiModel;
  maxTokens?: number;
  // Vendor-specific parameters
  candidateCount?: number;
  responseMimeType?: string;
  responseSchema?: Schema;
};

/**
 * Agent for Google Gemini models.
 *
 * @example
 * ```typescript
 * const agent = new GeminiAgent({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   apiKey: process.env.GOOGLE_API_KEY,
 * });
 *
 * const response = await agent.execute("Hello!");
 * ```
 */
export class GeminiAgent extends BaseAgent {
  private client: GoogleGenerativeAI;
  private generativeModel: GenerativeModel;
  protected config: Partial<AgentConfig>;

  /** Token usage from the last execution (for metrics tracking) */
  public lastTokenUsage?: TokenUsage;

  /** Current visualization event ID for tracking */
  private vizEventId?: string;

  /** Count of tool calls in current execution */
  private currentToolCallCount: number = 0;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "gemini" }, history);

    this.client = new GoogleGenerativeAI(config.apiKey);

    // Merge flat config with nested vendorConfig
    const vendorConfig = config.vendorConfig?.gemini || {};
    const candidateCount = config.candidateCount ?? vendorConfig.candidateCount;
    const responseMimeType =
      config.responseMimeType ?? vendorConfig.responseMimeType;
    const responseSchema = config.responseSchema ?? vendorConfig.responseSchema;

    this.config = {
      model: config.model || "gemini-2.0-flash",
      maxTokens: config.maxTokens || 1024,
      apiKey: config.apiKey,
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
      stopSequences: config.stopSequences,
      candidateCount,
      responseMimeType,
      responseSchema,
    };

    // Initialize the model
    this.generativeModel = this.client.getGenerativeModel({
      model: this.config.model!,
    });

    // Add system message to history (skips if already exists with same content)
    this.addSystemMessage(this.getSystemMessage());
  }

  protected getToolDefinitionsForGemini():
    | FunctionDeclarationsTool
    | undefined {
    const tools = Array.from(this.tools.values());
    if (tools.length === 0) {
      return undefined;
    }

    return {
      functionDeclarations: tools.map((tool) => {
        const prompt = tool.getPrompt();
        // Cast to unknown first to avoid type conflicts
        const schema = prompt.input_schema as unknown as Record<
          string,
          unknown
        >;
        return {
          name: prompt.name,
          description: prompt.description,
          parameters: this.convertSchemaToGeminiParams(schema),
        };
      }),
    };
  }

  /**
   * Convert JSON Schema to Gemini's FunctionDeclarationSchema format
   */
  private convertSchemaToGeminiParams(
    schema: Record<string, unknown>
  ): FunctionDeclarationSchema {
    const properties: { [k: string]: Schema } = {};

    if (schema.properties) {
      const props = schema.properties as Record<
        string,
        Record<string, unknown>
      >;
      for (const [key, value] of Object.entries(props)) {
        properties[key] = this.convertPropertyToSchema(value);
      }
    }

    return {
      type: SchemaType.OBJECT,
      properties,
      description: schema.description as string | undefined,
      required: schema.required as string[] | undefined,
    };
  }

  /**
   * Convert a property schema to Gemini Schema type
   */
  private convertPropertyToSchema(prop: Record<string, unknown>): Schema {
    const type = prop.type as string;
    const description = prop.description as string | undefined;

    switch (type) {
      case "string":
        if (prop.enum) {
          return {
            type: SchemaType.STRING,
            format: "enum",
            enum: prop.enum as string[],
            description,
          };
        }
        return { type: SchemaType.STRING, description };
      case "number":
        return { type: SchemaType.NUMBER, description };
      case "integer":
        return { type: SchemaType.INTEGER, description };
      case "boolean":
        return { type: SchemaType.BOOLEAN, description };
      case "array":
        return {
          type: SchemaType.ARRAY,
          items: this.convertPropertyToSchema(
            prop.items as Record<string, unknown>
          ),
          description,
        };
      case "object":
        const objProps: { [k: string]: Schema } = {};
        if (prop.properties) {
          const subProps = prop.properties as Record<
            string,
            Record<string, unknown>
          >;
          for (const [key, value] of Object.entries(subProps)) {
            objProps[key] = this.convertPropertyToSchema(value);
          }
        }
        return {
          type: SchemaType.OBJECT,
          properties: objProps,
          description,
          required: prop.required as string[] | undefined,
        };
      default:
        return { type: SchemaType.STRING, description };
    }
  }

  /**
   * Map JSON Schema types to Gemini's SchemaType
   */
  private mapJsonSchemaTypeToGemini(type: string): SchemaType {
    switch (type) {
      case "string":
        return SchemaType.STRING;
      case "number":
        return SchemaType.NUMBER;
      case "integer":
        return SchemaType.INTEGER;
      case "boolean":
        return SchemaType.BOOLEAN;
      case "array":
        return SchemaType.ARRAY;
      case "object":
        return SchemaType.OBJECT;
      default:
        return SchemaType.STRING;
    }
  }

  protected async process(_input: string): Promise<string> {
    return "";
  }

  async execute(input: string | MessageContent[]): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);

    // Reset token usage for this execution
    this.lastTokenUsage = undefined;
    this.currentToolCallCount = 0;

    const inputPreview =
      typeof input === "string" ? input : JSON.stringify(input);

    // Start visualization reporting
    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        "gemini",
        inputPreview
      );
    }

    if (this.history.transient) {
      this.history.clear();
      // Re-add system message after clear
      this.addSystemMessage(this.getSystemMessage());
    }

    if (typeof input === "string") {
      this.addTextToHistory("user", input);
    } else {
      this.addMessageToHistory("user", input);
    }

    // Mark session boundary so transform plugins (e.g. toolResultMaskingPlugin)
    // don't mask tool results produced within this execute() loop.
    this.history.setSessionAnchor();

    try {
      const contents = geminiTransformer.toProvider(this.history.getEntries());
      const systemMessage = this.history.getSystemMessage();
      const tools = this.getToolDefinitionsForGemini();

      const response = await this.generativeModel.generateContent({
        contents,
        systemInstruction: systemMessage,
        tools: tools ? [tools] : undefined,
        generationConfig: {
          maxOutputTokens: this.config.maxTokens,
          temperature: this.config.temperature,
          topP: this.config.topP,
          topK: this.config.topK,
          stopSequences: this.config.stopSequences,
          candidateCount: this.config.candidateCount,
          responseMimeType: this.config.responseMimeType,
          responseSchema: this.config.responseSchema,
        },
      });

      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error) {
      const err = error as { status?: number; message?: string };
      if (err.status) {
        const apiError = new ApiError(
          `Gemini API error: ${err.message || "Unknown error"}`,
          err.status,
          error
        );
        this.emit(AgentEvent.ERROR, apiError);

        // Report error to viz
        if (this.vizEventId) {
          vizReporter.agentError(
            this.vizEventId,
            "ApiError",
            apiError.message,
            err.status === 429
          );
          this.vizEventId = undefined;
        }

        throw apiError;
      } else {
        const executionError = new ExecutionError(
          `Error executing agent: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        this.emit(AgentEvent.ERROR, executionError);

        // Report error to viz
        if (this.vizEventId) {
          vizReporter.agentError(
            this.vizEventId,
            "ExecutionError",
            executionError.message,
            false
          );
          this.vizEventId = undefined;
        }

        throw executionError;
      }
    }
  }

  protected async handleResponse(
    response: GenerateContentResult
  ): Promise<string> {
    const result = response.response;

    // Parse and track usage
    if (result.usageMetadata) {
      const usage = this.parseUsage(result.usageMetadata);
      if (this.lastTokenUsage) {
        this.lastTokenUsage.input_tokens += usage.input_tokens;
        this.lastTokenUsage.output_tokens += usage.output_tokens;
        this.lastTokenUsage.total_tokens += usage.total_tokens;
      } else {
        this.lastTokenUsage = { ...usage };
      }
    }

    // Check for finish reason
    const candidate = result.candidates?.[0];
    if (!candidate) {
      const error = new ExecutionError("No candidates in Gemini response");
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }

    if (candidate.finishReason === "MAX_TOKENS") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens || 1024
      );
      this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
      this.emit(AgentEvent.ERROR, error);

      // Report error to viz
      if (this.vizEventId) {
        vizReporter.agentError(
          this.vizEventId,
          "MaxTokensExceededError",
          error.message,
          false
        );
        this.vizEventId = undefined;
      }

      throw error;
    }

    const parts = candidate.content?.parts || [];
    const functionCalls = parts.filter(
      (part: Part): part is Part & { functionCall: FunctionCall } =>
        "functionCall" in part
    );

    // If no function calls, return text response
    if (functionCalls.length === 0) {
      const textParts = parts.filter((part: Part) => "text" in part);
      const textContent = textParts
        .map((part: Part) => ("text" in part ? part.text : ""))
        .join("");

      // Add to history in normalized format
      const entry = geminiTransformer.fromProviderContent("assistant", parts);
      this.addToHistory(entry);

      this.emit(AgentEvent.DONE, result, this.lastTokenUsage);

      // Report completion to viz
      if (this.vizEventId) {
        vizReporter.agentComplete(
          this.vizEventId,
          {
            input: this.lastTokenUsage?.input_tokens || 0,
            output: this.lastTokenUsage?.output_tokens || 0,
            total: this.lastTokenUsage?.total_tokens || 0,
          },
          "end_turn",
          this.currentToolCallCount > 0,
          this.currentToolCallCount,
          textContent
        );
        this.vizEventId = undefined;
      }

      return textContent;
    }

    // Handle function calls
    try {
      this.emit(AgentEvent.TOOL_USE, functionCalls);

      // Add assistant response with function calls to history (normalized)
      const assistantEntry = geminiTransformer.fromProviderContent(
        "assistant",
        parts
      );
      this.addToHistory(assistantEntry);

      const toolResults = await this.handleFunctionCalls(functionCalls);

      // Add tool results to history (normalized)
      for (const tr of toolResults) {
        const resultEntry = geminiTransformer.toolResultEntry(
          tr.name,
          tr.response
        );
        this.addToHistory(resultEntry);
      }

      // Continue conversation
      try {
        const newContents = geminiTransformer.toProvider(this.history.getEntries());
        const systemMessage = this.history.getSystemMessage();
        const tools = this.getToolDefinitionsForGemini();

        const newResponse = await this.generativeModel.generateContent({
          contents: newContents,
          systemInstruction: systemMessage,
          tools: tools ? [tools] : undefined,
          generationConfig: {
            maxOutputTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            topP: this.config.topP,
            topK: this.config.topK,
            stopSequences: this.config.stopSequences,
            candidateCount: this.config.candidateCount,
            responseMimeType: this.config.responseMimeType,
            responseSchema: this.config.responseSchema,
          },
        });

        this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
        return this.handleResponse(newResponse);
      } catch (error) {
        const err = error as { status?: number; message?: string };
        if (err.status) {
          const apiError = new ApiError(
            `Gemini API error during tool response: ${
              err.message || "Unknown error"
            }`,
            err.status,
            error
          );
          this.emit(AgentEvent.ERROR, apiError);
          throw apiError;
        } else {
          throw new ExecutionError(
            `Error handling tool response: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        this.emit(AgentEvent.TOOL_ERROR, error);
        throw error;
      }

      const toolError = new ExecutionError(
        `Error during tool execution: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit(AgentEvent.ERROR, toolError);

      // Report error to viz
      if (this.vizEventId) {
        vizReporter.agentError(
          this.vizEventId,
          "ExecutionError",
          toolError.message,
          false
        );
        this.vizEventId = undefined;
      }

      throw toolError;
    }
  }

  private async handleFunctionCalls(
    functionCalls: Array<Part & { functionCall: FunctionCall }>
  ): Promise<Array<{ name: string; response: string }>> {
    if (!functionCalls.length) {
      throw new ExecutionError("No function calls found in response");
    }

    // Track tool call count for viz reporting
    this.currentToolCallCount += functionCalls.length;

    const results = await Promise.all(
      functionCalls.map(async (part) => {
        const fc = part.functionCall;
        const toolName = fc.name;
        const tool = this.tools.get(toolName);

        if (!tool) {
          const errorMessage = `Tool '${toolName}' not found`;
          const error = new ToolExecutionError(errorMessage, toolName, fc.args);

          if (this.debug) {
            console.error(error);
          }

          return {
            name: toolName,
            response: JSON.stringify({ error: errorMessage }),
          };
        }

        try {
          const args = (fc.args || {}) as Record<string, unknown>;

          const result = await tool.execute(
            this.getId(),
            this.getName(),
            args,
            toolName, // Gemini uses function name as ID
            this.config.model,
            "gemini"
          );

          return {
            name: toolName,
            response: JSON.stringify(result),
          };
        } catch (error) {
          const errorMessage = `Error executing tool '${toolName}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`;

          if (this.debug) {
            console.error(errorMessage);
          }

          const toolError = new ToolExecutionError(
            errorMessage,
            toolName,
            fc.args
          );
          this.emit(AgentEvent.TOOL_ERROR, toolError);

          return {
            name: toolName,
            response: JSON.stringify({ error: errorMessage }),
          };
        }
      })
    );

    return results;
  }

  protected parseUsage(input: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  }): TokenUsage {
    return {
      input_tokens: input.promptTokenCount || 0,
      output_tokens: input.candidatesTokenCount || 0,
      total_tokens: input.totalTokenCount || 0,
    };
  }
}
