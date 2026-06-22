/**
 * VizReporter - Singleton for sending visualization events to @agention/viz.
 *
 * This class manages WebSocket connections and event reporting for agent monitoring.
 * Events are queued when disconnected and flushed on reconnection.
 */

import { EventEmitter } from "events";
import { vizConfig } from "./VizConfig";
import {
  VizEvent,
  VizSource,
  VizVendor,
  VizTokenUsage,
  VizStopReason,
  VizPipelineStructure,
  VizExecutorType,
  AgentStartPayload,
  AgentCompletePayload,
  AgentErrorPayload,
  ToolStartPayload,
  ToolCompletePayload,
  ToolErrorPayload,
  SessionStartPayload,
  SessionEndPayload,
  PipelineStartPayload,
  PipelineEndPayload,
  ExecutorStartPayload,
  ExecutorEndPayload,
} from "./types";

// WebSocket implementation - supports both browser and Node.js
// In Node.js, requires 'ws' package to be installed
let WebSocketImpl: typeof WebSocket | null = null;
let wsModuleLoaded = false;

async function loadWebSocket(): Promise<typeof WebSocket | null> {
  if (wsModuleLoaded) return WebSocketImpl;
  wsModuleLoaded = true;

  // Check for browser WebSocket
  if (typeof WebSocket !== "undefined") {
    WebSocketImpl = WebSocket;
    return WebSocketImpl;
  }

  // Try to load Node.js ws module
  try {
    // Use dynamic import with a variable to avoid TypeScript resolution
    const moduleName = "ws";
    const wsModule = await import(/* webpackIgnore: true */ moduleName);
    WebSocketImpl = wsModule.default || wsModule;
    return WebSocketImpl;
  } catch {
    // ws module not installed - visualization will be disabled
    return null;
  }
}

/**
 * Generate a unique ID for events
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;
}

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLength: number = 200): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

/**
 * Safely stringify an object for summaries
 */
function summarize(obj: unknown, maxLength: number = 200): string {
  try {
    const str = typeof obj === "string" ? obj : JSON.stringify(obj);
    return truncate(str, maxLength);
  } catch {
    return "[Unable to serialize]";
  }
}

interface EventTiming {
  startTime: number;
  source: VizSource;
}

export class VizReporter extends EventEmitter {
  private static instance: VizReporter | null = null;

  private ws: WebSocket | null = null;
  private queue: VizEvent[] = [];
  private currentSessionId: string | null = null;
  private currentPipelineId: string | null = null;
  private eventStack: string[] = [];
  private eventTimings: Map<string, EventTiming> = new Map();
  private connecting: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    super();
    this.initWebSocket();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): VizReporter {
    if (!VizReporter.instance) {
      VizReporter.instance = new VizReporter();
    }
    return VizReporter.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static resetInstance(): void {
    if (VizReporter.instance) {
      VizReporter.instance.disconnect();
      VizReporter.instance = null;
    }
  }

  /**
   * Initialize WebSocket connection
   */
  private async initWebSocket(): Promise<void> {
    if (!vizConfig.isEnabled()) return;

    // Load WebSocket implementation
    const ws = await loadWebSocket();
    if (!ws) {
      // WebSocket not available - this is fine, visualization just won't work
      return;
    }

    this.tryConnect();
  }

  /**
   * Attempt to connect to the visualization server
   */
  private async tryConnect(): Promise<void> {
    if (!vizConfig.isEnabled() || this.connecting || this.ws) return;

    // Ensure WebSocket is loaded
    const WS = await loadWebSocket();
    if (!WS) return;

    this.connecting = true;

    try {
      const ws = new WS(vizConfig.getUrl());

      ws.onopen = () => {
        this.ws = ws;
        this.connecting = false;
        this.emit("connected");
        this.flushQueue();
      };

      ws.onclose = () => {
        this.ws = null;
        this.connecting = false;
        this.emit("disconnected");
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!vizConfig.get().reconnect) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.tryConnect();
    }, vizConfig.get().reconnectInterval);
  }

  /**
   * Flush queued events
   */
  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== 1) return; // 1 = OPEN

    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (event) {
        this.ws.send(JSON.stringify(event));
      }
    }
  }

  /**
   * Disconnect from the visualization server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connecting = false;
  }

  /**
   * Check if connected to the visualization server
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1; // 1 = OPEN
  }

  /**
   * Send an event to the visualization server
   */
  private send(event: Partial<VizEvent>): void {
    if (!vizConfig.isEnabled()) return;

    const fullEvent: VizEvent = {
      eventId: event.eventId || generateId(),
      sessionId: event.sessionId || this.currentSessionId || "default",
      pipelineId: event.pipelineId || this.currentPipelineId || undefined,
      parentEventId:
        event.parentEventId ||
        (this.eventStack.length > 0
          ? this.eventStack[this.eventStack.length - 1]
          : undefined),
      timestamp: event.timestamp || Date.now(),
      durationMs: event.durationMs,
      eventType: event.eventType!,
      source: event.source!,
      payload: event.payload!,
    };

    if (this.ws && this.ws.readyState === 1) {
      // 1 = OPEN
      this.ws.send(JSON.stringify(fullEvent));
    } else {
      // Queue the event
      if (this.queue.length < vizConfig.get().maxQueueSize) {
        this.queue.push(fullEvent);
      }
      // Try to connect if not already
      this.tryConnect();
    }
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Start a new session
   */
  startSession(name?: string): string {
    const sessionId = generateId();
    this.currentSessionId = sessionId;

    const sessionName = name || vizConfig.getSessionName() || undefined;

    this.send({
      eventId: sessionId,
      sessionId,
      eventType: "session.start",
      source: {
        agentId: "system",
        agentName: "System",
        model: "n/a",
        vendor: "anthropic",
      },
      payload: { name: sessionName } as SessionStartPayload,
    });

    return sessionId;
  }

  /**
   * End the current session
   */
  endSession(reason: "completed" | "error" | "timeout" = "completed"): void {
    if (!this.currentSessionId) return;

    this.send({
      sessionId: this.currentSessionId,
      eventType: "session.end",
      source: {
        agentId: "system",
        agentName: "System",
        model: "n/a",
        vendor: "anthropic",
      },
      payload: { reason } as SessionEndPayload,
    });

    this.currentSessionId = null;
  }

  /**
   * Get or create a session ID
   */
  getSessionId(): string {
    if (!this.currentSessionId) {
      return this.startSession();
    }
    return this.currentSessionId;
  }

  /**
   * Set the current session ID (for external session management)
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  // ============================================
  // Pipeline Management
  // ============================================

  /**
   * Start a pipeline execution
   */
  pipelineStart(
    name: string,
    structure: VizPipelineStructure,
    input: string,
    source: VizSource
  ): string {
    const eventId = generateId();
    this.currentPipelineId = eventId;
    this.eventStack.push(eventId);
    this.eventTimings.set(eventId, { startTime: Date.now(), source });

    this.send({
      eventId,
      pipelineId: eventId,
      eventType: "pipeline.start",
      source,
      payload: {
        pipelineName: name,
        nodeType: "pipeline",
        structure,
        inputPreview: truncate(input),
      } as PipelineStartPayload,
    });

    return eventId;
  }

  /**
   * End a pipeline execution
   */
  pipelineEnd(
    eventId: string,
    success: boolean,
    totalTokens: VizTokenUsage,
    nodeCount: number,
    output?: string,
    error?: string
  ): void {
    const timing = this.eventTimings.get(eventId);
    const durationMs = timing ? Date.now() - timing.startTime : undefined;

    this.send({
      eventId,
      pipelineId: eventId,
      eventType: "pipeline.end",
      durationMs,
      source: timing?.source || {
        agentId: "system",
        agentName: "System",
        model: "n/a",
        vendor: "anthropic",
      },
      payload: {
        success,
        totalTokens,
        nodeCount,
        outputPreview: output ? truncate(output) : undefined,
        error,
      } as PipelineEndPayload,
    });

    this.eventTimings.delete(eventId);
    this.popEventStack(eventId);

    if (this.currentPipelineId === eventId) {
      this.currentPipelineId = null;
    }
  }

  // ============================================
  // Executor Management
  // ============================================

  /**
   * Start an executor (sequential, parallel, map, voting, router)
   */
  executorStart(
    name: string,
    type: VizExecutorType,
    childCount: number,
    input: string,
    source: VizSource
  ): string {
    const eventId = generateId();
    this.eventStack.push(eventId);
    this.eventTimings.set(eventId, { startTime: Date.now(), source });

    this.send({
      eventId,
      eventType: "executor.start",
      source,
      payload: {
        executorName: name,
        executorType: type,
        childCount,
        inputPreview: truncate(input),
      } as ExecutorStartPayload,
    });

    return eventId;
  }

  /**
   * End an executor
   */
  executorEnd(
    eventId: string,
    success: boolean,
    totalTokens: VizTokenUsage,
    output?: string,
    error?: string
  ): void {
    const timing = this.eventTimings.get(eventId);
    const durationMs = timing ? Date.now() - timing.startTime : undefined;

    this.send({
      eventId,
      eventType: "executor.end",
      durationMs,
      source: timing?.source || {
        agentId: "system",
        agentName: "System",
        model: "n/a",
        vendor: "anthropic",
      },
      payload: {
        success,
        totalTokens,
        outputPreview: output ? truncate(output) : undefined,
        error,
      } as ExecutorEndPayload,
    });

    this.eventTimings.delete(eventId);
    this.popEventStack(eventId);
  }

  // ============================================
  // Agent Events
  // ============================================

  /**
   * Report agent execution start
   */
  agentStart(
    agentId: string,
    agentName: string,
    model: string,
    vendor: VizVendor,
    input: string
  ): string {
    const eventId = generateId();
    const source: VizSource = { agentId, agentName, model, vendor };

    this.eventStack.push(eventId);
    this.eventTimings.set(eventId, { startTime: Date.now(), source });

    this.send({
      eventId,
      eventType: "agent.start",
      source,
      payload: {
        inputPreview: truncate(input),
      } as AgentStartPayload,
    });

    return eventId;
  }

  /**
   * Report agent execution complete
   */
  agentComplete(
    eventId: string,
    tokens: VizTokenUsage,
    stopReason: VizStopReason,
    hasToolCalls: boolean,
    toolCallCount: number,
    output: string
  ): void {
    const timing = this.eventTimings.get(eventId);
    const durationMs = timing ? Date.now() - timing.startTime : undefined;

    this.send({
      eventId,
      eventType: "agent.complete",
      durationMs,
      source: timing?.source || {
        agentId: "unknown",
        agentName: "Unknown",
        model: "unknown",
        vendor: "anthropic",
      },
      payload: {
        tokens,
        stopReason,
        hasToolCalls,
        toolCallCount,
        outputPreview: truncate(output),
      } as AgentCompletePayload,
    });

    this.eventTimings.delete(eventId);
    this.popEventStack(eventId);
  }

  /**
   * Report agent execution error
   */
  agentError(
    eventId: string,
    errorType: string,
    errorMessage: string,
    retryable: boolean = false
  ): void {
    const timing = this.eventTimings.get(eventId);
    const durationMs = timing ? Date.now() - timing.startTime : undefined;

    this.send({
      eventId,
      eventType: "agent.error",
      durationMs,
      source: timing?.source || {
        agentId: "unknown",
        agentName: "Unknown",
        model: "unknown",
        vendor: "anthropic",
      },
      payload: {
        errorType,
        errorMessage: truncate(errorMessage, 500),
        retryable,
      } as AgentErrorPayload,
    });

    this.eventTimings.delete(eventId);
    this.popEventStack(eventId);
  }

  // ============================================
  // Tool Events
  // ============================================

  /**
   * Report tool execution start
   */
  toolStart(
    toolName: string,
    toolId: string,
    input: unknown,
    agentSource: VizSource
  ): string {
    const eventId = generateId();
    this.eventTimings.set(eventId, {
      startTime: Date.now(),
      source: agentSource,
    });

    this.send({
      eventId,
      eventType: "tool.start",
      source: agentSource,
      payload: {
        toolName,
        toolId,
        inputSummary: summarize(input),
      } as ToolStartPayload,
    });

    return eventId;
  }

  /**
   * Report tool execution complete
   */
  toolComplete(
    eventId: string,
    toolName: string,
    toolId: string,
    success: boolean,
    result: unknown
  ): void {
    const timing = this.eventTimings.get(eventId);
    const durationMs = timing ? Date.now() - timing.startTime : undefined;

    this.send({
      eventId,
      eventType: "tool.complete",
      durationMs,
      source: timing?.source || {
        agentId: "unknown",
        agentName: "Unknown",
        model: "unknown",
        vendor: "anthropic",
      },
      payload: {
        toolName,
        toolId,
        success,
        resultSummary: summarize(result),
      } as ToolCompletePayload,
    });

    this.eventTimings.delete(eventId);
  }

  /**
   * Report tool execution error
   */
  toolError(
    eventId: string,
    toolName: string,
    toolId: string,
    errorMessage: string
  ): void {
    const timing = this.eventTimings.get(eventId);
    const durationMs = timing ? Date.now() - timing.startTime : undefined;

    this.send({
      eventId,
      eventType: "tool.error",
      durationMs,
      source: timing?.source || {
        agentId: "unknown",
        agentName: "Unknown",
        model: "unknown",
        vendor: "anthropic",
      },
      payload: {
        toolName,
        toolId,
        errorMessage: truncate(errorMessage, 500),
      } as ToolErrorPayload,
    });

    this.eventTimings.delete(eventId);
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Pop an event from the stack
   */
  private popEventStack(eventId: string): void {
    const index = this.eventStack.lastIndexOf(eventId);
    if (index !== -1) {
      this.eventStack.splice(index, 1);
    }
  }

  /**
   * Get current event stack depth
   */
  getStackDepth(): number {
    return this.eventStack.length;
  }

  /**
   * Get queued event count
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

/** Global VizReporter instance */
export const vizReporter = VizReporter.getInstance();
