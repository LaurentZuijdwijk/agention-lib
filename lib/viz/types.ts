/**
 * Visualization event types and interfaces for agent monitoring.
 * These types define the contract between agention-lib and @agention/viz.
 */

export type VizVendor = "anthropic" | "openai" | "mistral" | "gemini";

export type VizEventType =
  | "session.start"
  | "session.end"
  | "pipeline.start"
  | "pipeline.end"
  | "executor.start"
  | "executor.end"
  | "agent.start"
  | "agent.complete"
  | "agent.error"
  | "tool.start"
  | "tool.complete"
  | "tool.error"
  | "message.user"
  | "message.assistant";

export type VizExecutorType =
  | "sequential"
  | "parallel"
  | "map"
  | "voting"
  | "router";

export type VizStopReason =
  | "end_turn"
  | "tool_use"
  | "max_tokens"
  | "stop_sequence"
  | "error";

export interface VizTokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface VizSource {
  agentId: string;
  agentName: string;
  model: string;
  vendor: VizVendor;
}

export interface VizPipelineStructure {
  name: string;
  type:
    | "sequential"
    | "parallel"
    | "pipeline"
    | "map"
    | "voting"
    | "router"
    | "agent";
  children?: VizPipelineStructure[];
}

// Base event interface
export interface VizEvent {
  eventId: string;
  sessionId: string;
  pipelineId?: string;
  parentEventId?: string;
  timestamp: number;
  durationMs?: number;
  eventType: VizEventType;
  source: VizSource;
  payload: VizEventPayload;
}

// Payload types
export interface SessionStartPayload {
  name?: string;
}

export interface SessionEndPayload {
  reason: "completed" | "error" | "timeout";
}

export interface PipelineStartPayload {
  pipelineName: string;
  nodeType: "pipeline";
  structure: VizPipelineStructure;
  inputPreview: string;
}

export interface PipelineEndPayload {
  success: boolean;
  totalTokens: VizTokenUsage;
  nodeCount: number;
  outputPreview?: string;
  error?: string;
}

export interface ExecutorStartPayload {
  executorName: string;
  executorType: VizExecutorType;
  childCount: number;
  inputPreview: string;
}

export interface ExecutorEndPayload {
  success: boolean;
  totalTokens: VizTokenUsage;
  outputPreview?: string;
  error?: string;
}

export interface AgentStartPayload {
  inputPreview: string;
}

export interface AgentCompletePayload {
  tokens: VizTokenUsage;
  stopReason: VizStopReason;
  hasToolCalls: boolean;
  toolCallCount: number;
  outputPreview: string;
}

export interface AgentErrorPayload {
  errorType: string;
  errorMessage: string;
  retryable: boolean;
}

export interface ToolStartPayload {
  toolName: string;
  toolId: string;
  inputSummary: string;
}

export interface ToolCompletePayload {
  toolName: string;
  toolId: string;
  success: boolean;
  resultSummary: string;
}

export interface ToolErrorPayload {
  toolName: string;
  toolId: string;
  errorMessage: string;
}

export interface MessagePayload {
  role: "user" | "assistant";
  contentPreview: string;
  contentLength: number;
  hasToolUse?: boolean;
}

export type VizEventPayload =
  | SessionStartPayload
  | SessionEndPayload
  | PipelineStartPayload
  | PipelineEndPayload
  | ExecutorStartPayload
  | ExecutorEndPayload
  | AgentStartPayload
  | AgentCompletePayload
  | AgentErrorPayload
  | ToolStartPayload
  | ToolCompletePayload
  | ToolErrorPayload
  | MessagePayload;
