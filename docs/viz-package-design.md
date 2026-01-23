# @agention/viz - Agent Visualization Dashboard

## Overview

Build a standalone visualization package that provides real-time monitoring of AI agent activity. The package runs a local server that receives events from `agention-lib` agents via WebSocket and displays them in an interactive React Flow-based dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    @agention/viz Package                         │
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │   WebSocket      │────▶│   Event Store    │                  │
│  │   Server         │     │   (in-memory)    │                  │
│  │   (port 4242)    │     │                  │                  │
│  └──────────────────┘     └────────┬─────────┘                  │
│                                    │                             │
│  ┌──────────────────┐              │                             │
│  │   HTTP Server    │              │                             │
│  │   (same port)    │              │                             │
│  │   serves dashboard│              │                             │
│  └──────────────────┘              │                             │
│                                    ▼                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  React Dashboard                           │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ Session     │ │ Pipeline    │ │ Event Timeline      │  │  │
│  │  │ Sidebar     │ │ Graph       │ │ & Details           │  │  │
│  │  │             │ │ (ReactFlow) │ │                     │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Package Structure

```
packages/viz/
├── package.json
├── tsconfig.json
├── vite.config.ts              # For bundling dashboard
├── src/
│   ├── server/
│   │   ├── index.ts            # Main server entry
│   │   ├── WebSocketHandler.ts # WS connection management
│   │   ├── EventStore.ts       # In-memory event storage
│   │   ├── SessionManager.ts   # Session correlation logic
│   │   └── types.ts            # Server-side types
│   ├── cli/
│   │   └── index.ts            # CLI entry point
│   ├── shared/
│   │   └── events.ts           # Event type definitions (shared with core lib)
│   └── dashboard/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── hooks/
│       │   ├── useWebSocket.ts       # WS connection to server
│       │   ├── useSessions.ts        # Session state management
│       │   └── useGraphLayout.ts     # Dagre layout computation
│       ├── components/
│       │   ├── Layout.tsx            # Main layout wrapper
│       │   ├── SessionSidebar.tsx    # List of active sessions
│       │   ├── PipelineGraph.tsx     # React Flow canvas
│       │   ├── EventTimeline.tsx     # Chronological event list
│       │   ├── EventDetails.tsx      # Selected event details
│       │   ├── MetricsPanel.tsx      # Token/timing aggregates
│       │   └── nodes/                # Custom React Flow nodes
│       │       ├── AgentNode.tsx
│       │       ├── ToolNode.tsx
│       │       ├── PipelineNode.tsx
│       │       └── index.ts
│       ├── stores/
│       │   └── vizStore.ts           # Zustand store for state
│       ├── utils/
│       │   ├── graphBuilder.ts       # Events → React Flow nodes/edges
│       │   └── formatters.ts         # Display formatting helpers
│       └── styles/
│           └── index.css             # Tailwind or vanilla CSS
└── dist/                             # Built output
```

## Event Schema

Events are received from `agention-lib` via WebSocket. The core library will send these events:

```typescript
// shared/events.ts

export interface VizEvent {
  // Identification
  eventId: string;                // Unique event ID (uuid)
  sessionId: string;              // Groups events in a conversation/run
  pipelineId?: string;            // Groups events within a pipeline execution
  parentEventId?: string;         // Creates parent-child hierarchy
  
  // Timing
  timestamp: number;              // Unix ms when event was created
  durationMs?: number;            // For completion events
  
  // Event type
  eventType: VizEventType;
  
  // Source
  source: {
    agentId: string;              // Agent instance ID
    agentName: string;            // Human-readable name
    model: string;                // e.g., "claude-sonnet-4-20250514"
    vendor: 'anthropic' | 'openai' | 'mistral' | 'google';
  };
  
  // Event-specific data
  payload: VizEventPayload;
}

export type VizEventType = 
  | 'session.start'
  | 'session.end'
  | 'pipeline.start'
  | 'pipeline.end'
  | 'executor.start'      // For sequential, parallel, map, voting, router
  | 'executor.end'
  | 'agent.start'
  | 'agent.complete'
  | 'agent.error'
  | 'tool.start'
  | 'tool.complete'
  | 'tool.error'
  | 'message.user'
  | 'message.assistant';

// Payload types for each event
export interface SessionStartPayload {
  name?: string;
}

export interface SessionEndPayload {
  reason: 'completed' | 'error' | 'timeout';
}

export interface PipelineStartPayload {
  pipelineName: string;
  nodeType: 'pipeline';
  structure: PipelineStructure;   // Nested structure for visualization
  inputPreview: string;           // First 200 chars of input
}

export interface PipelineEndPayload {
  success: boolean;
  totalTokens: TokenUsage;
  nodeCount: number;
  outputPreview?: string;
  error?: string;
}

export interface ExecutorStartPayload {
  executorName: string;
  executorType: 'sequential' | 'parallel' | 'map' | 'voting' | 'router';
  childCount: number;             // Number of child nodes
  inputPreview: string;
}

export interface ExecutorEndPayload {
  success: boolean;
  totalTokens: TokenUsage;
  outputPreview?: string;
  error?: string;
}

export interface AgentStartPayload {
  inputPreview: string;
}

export interface AgentCompletePayload {
  tokens: TokenUsage;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  hasToolCalls: boolean;
  toolCallCount: number;
  outputPreview: string;
}

export interface AgentErrorPayload {
  errorType: string;              // e.g., 'ApiError', 'RateLimitError'
  errorMessage: string;
  retryable: boolean;
}

export interface ToolStartPayload {
  toolName: string;
  toolId: string;                 // Unique ID for this tool invocation
  inputSummary: string;           // Formatted input args
}

export interface ToolCompletePayload {
  toolName: string;
  toolId: string;
  success: boolean;
  resultSummary: string;          // Truncated result
}

export interface ToolErrorPayload {
  toolName: string;
  toolId: string;
  errorMessage: string;
}

export interface MessagePayload {
  role: 'user' | 'assistant';
  contentPreview: string;
  contentLength: number;
  hasToolUse?: boolean;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface PipelineStructure {
  name: string;
  type: 'sequential' | 'parallel' | 'pipeline' | 'map' | 'voting' | 'router' | 'agent';
  children?: PipelineStructure[];
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
```

## Server Implementation

### CLI Entry Point

```typescript
// cli/index.ts
#!/usr/bin/env node

import { startServer } from '../server';
import { program } from 'commander';

program
  .name('agention-viz')
  .description('Visualization dashboard for agention-lib agents')
  .option('-p, --port <number>', 'Port to listen on', '4242')
  .option('-o, --open', 'Open browser automatically', false)
  .option('--no-cors', 'Disable CORS (for production)')
  .parse();

const options = program.opts();

startServer({
  port: parseInt(options.port),
  open: options.open,
  cors: options.cors !== false,
});
```

### Server Requirements

1. **HTTP Server** (Express or Fastify)
   - Serve the built React dashboard at `/`
   - Health check endpoint at `/health`
   - REST endpoint `GET /api/sessions` to list active sessions
   - REST endpoint `GET /api/sessions/:id` to get session data

2. **WebSocket Server** (ws library)
   - Accept connections on the same port
   - Path: `/ws` for dashboard clients (read-only, receive events)
   - Path: `/ws/agent` for agent connections (write, send events)
   - Broadcast events to all dashboard clients when received from agents

3. **Event Store**
   - In-memory storage (no persistence required)
   - Organize events by sessionId
   - Support querying events by sessionId, pipelineId, eventType
   - Auto-cleanup: remove sessions older than 1 hour
   - Max sessions limit: 100 (remove oldest when exceeded)

### Session Correlation Logic

```typescript
// server/SessionManager.ts

interface Session {
  id: string;
  name?: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'error';
  events: VizEvent[];
  pipelines: Map<string, Pipeline>;
  metrics: SessionMetrics;
}

interface Pipeline {
  id: string;
  name: string;
  structure: PipelineStructure;
  events: VizEvent[];
  status: 'running' | 'completed' | 'error';
}

interface SessionMetrics {
  totalTokens: TokenUsage;
  totalDurationMs: number;
  agentCallCount: number;
  toolCallCount: number;
  errorCount: number;
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  
  processEvent(event: VizEvent): void {
    // 1. Get or create session
    let session = this.sessions.get(event.sessionId);
    if (!session) {
      session = this.createSession(event.sessionId);
    }
    
    // 2. Add event to session
    session.events.push(event);
    
    // 3. Handle pipeline correlation
    if (event.pipelineId) {
      let pipeline = session.pipelines.get(event.pipelineId);
      if (!pipeline && event.eventType === 'pipeline.start') {
        pipeline = this.createPipeline(event);
        session.pipelines.set(event.pipelineId, pipeline);
      }
      pipeline?.events.push(event);
    }
    
    // 4. Update metrics
    this.updateMetrics(session, event);
    
    // 5. Update status
    this.updateSessionStatus(session, event);
  }
  
  getSessionGraph(sessionId: string): { nodes: Node[], edges: Edge[] } {
    // Transform session events into React Flow graph
  }
}
```

## Dashboard Implementation

### Technology Stack

- **React 18** with TypeScript
- **React Flow** (@xyflow/react) for graph visualization
- **Zustand** for state management
- **Dagre** for automatic graph layout
- **Tailwind CSS** for styling (or vanilla CSS if preferred)
- **Vite** for building

### Main Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Agention Viz                                        [Status: Connected]│
├────────────┬────────────────────────────────────────────────────────────┤
│            │                                                            │
│  Sessions  │              Pipeline Graph (React Flow)                   │
│            │                                                            │
│  ○ Session │     ┌─────────┐      ┌─────────┐      ┌─────────┐        │
│    #abc123 │     │ Agent A │─────▶│ Agent B │─────▶│ Agent C │        │
│    2 min   │     │ Claude  │      │ GPT-4   │      │ Claude  │        │
│            │     │ ✓ 1.2s  │      │ ⟳ run.. │      │ ○ wait  │        │
│  ● Session │     └─────────┘      └─────────┘      └─────────┘        │
│    #def456 │                            │                              │
│    active  │                            ▼                              │
│            │                      ┌─────────┐                          │
│            │                      │ Tool:   │                          │
│            │                      │ search  │                          │
│            │                      │ ✓ 0.3s  │                          │
│            │                      └─────────┘                          │
│            │                                                            │
├────────────┴────────────────────────────────────────────────────────────┤
│  Event Timeline                                          Metrics        │
│  ────────────────────────────────────────────────────   ─────────────  │
│  12:01:23  agent.start     Agent A    "What is..."     Tokens: 1,234   │
│  12:01:24  agent.complete  Agent A    1.2s, 456 tok    Duration: 4.2s  │
│  12:01:24  agent.start     Agent B    "Research..."    Agents: 3       │
│  12:01:25  tool.start      search     query: "AI"      Tools: 2        │
│  12:01:25  tool.complete   search     0.3s, success    Errors: 0       │
│  ► 12:01:26  agent.complete  Agent B  ⟳ running...                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### React Flow Node Types

Create custom nodes for each entity type:

```typescript
// dashboard/components/nodes/AgentNode.tsx

import { Handle, Position, NodeProps } from '@xyflow/react';

interface AgentNodeData {
  name: string;
  model: string;
  vendor: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  tokens?: TokenUsage;
  durationMs?: number;
  error?: string;
}

export function AgentNode({ data }: NodeProps<AgentNodeData>) {
  const statusColors = {
    pending: 'bg-gray-100 border-gray-300',
    running: 'bg-blue-50 border-blue-400 animate-pulse',
    completed: 'bg-green-50 border-green-400',
    error: 'bg-red-50 border-red-400',
  };
  
  const statusIcons = {
    pending: '○',
    running: '⟳',
    completed: '✓',
    error: '✗',
  };
  
  return (
    <div className={`px-4 py-2 rounded-lg border-2 ${statusColors[data.status]}`}>
      <Handle type="target" position={Position.Left} />
      
      <div className="font-semibold">{data.name}</div>
      <div className="text-xs text-gray-500">{data.model}</div>
      
      <div className="flex items-center gap-2 mt-1 text-sm">
        <span>{statusIcons[data.status]}</span>
        {data.durationMs && <span>{(data.durationMs / 1000).toFixed(1)}s</span>}
        {data.tokens && <span>{data.tokens.total} tok</span>}
      </div>
      
      {data.error && (
        <div className="text-xs text-red-600 mt-1">{data.error}</div>
      )}
      
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

```typescript
// dashboard/components/nodes/ToolNode.tsx

interface ToolNodeData {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  durationMs?: number;
  inputSummary?: string;
  resultSummary?: string;
  error?: string;
}

export function ToolNode({ data }: NodeProps<ToolNodeData>) {
  // Similar structure, different styling (e.g., hexagonal or diamond shape)
  // Tool nodes typically have a different visual style to distinguish from agents
}
```

```typescript
// dashboard/components/nodes/ExecutorNode.tsx

interface ExecutorNodeData {
  name: string;
  type: 'sequential' | 'parallel' | 'map' | 'voting' | 'router';
  status: 'pending' | 'running' | 'completed' | 'error';
  childCount: number;
  tokens?: TokenUsage;
}

export function ExecutorNode({ data }: NodeProps<ExecutorNodeData>) {
  // Container-style node that groups child nodes
  // Different colors/icons per executor type
  const typeIcons = {
    sequential: '→',
    parallel: '⇉',
    map: '∀',
    voting: '⚖',
    router: '⑂',
  };
}
```

### Graph Builder

Transform events into React Flow format:

```typescript
// dashboard/utils/graphBuilder.ts

import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

interface GraphBuilderOptions {
  direction: 'LR' | 'TB';  // Left-to-right or top-to-bottom
  nodeSpacing: number;
  rankSpacing: number;
}

export function buildGraph(
  events: VizEvent[],
  options: GraphBuilderOptions = { direction: 'LR', nodeSpacing: 50, rankSpacing: 100 }
): { nodes: Node[], edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeMap = new Map<string, Node>();
  
  // 1. Create nodes from events
  for (const event of events) {
    if (event.eventType.endsWith('.start')) {
      const node = createNodeFromEvent(event);
      nodes.push(node);
      nodeMap.set(event.eventId, node);
    }
    
    // Update node status on completion
    if (event.eventType.endsWith('.complete') || event.eventType.endsWith('.end')) {
      const startEventId = findStartEventId(event, events);
      const node = nodeMap.get(startEventId);
      if (node) {
        updateNodeFromCompletion(node, event);
      }
    }
  }
  
  // 2. Create edges from parent-child relationships
  for (const event of events) {
    if (event.parentEventId && event.eventType.endsWith('.start')) {
      edges.push({
        id: `${event.parentEventId}-${event.eventId}`,
        source: event.parentEventId,
        target: event.eventId,
        animated: isEventRunning(event, events),
      });
    }
  }
  
  // 3. Apply dagre layout
  const layoutedNodes = applyDagreLayout(nodes, edges, options);
  
  return { nodes: layoutedNodes, edges };
}

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: GraphBuilderOptions
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: options.direction, nodesep: options.nodeSpacing, ranksep: options.rankSpacing });
  g.setDefaultEdgeLabel(() => ({}));
  
  nodes.forEach(node => {
    g.setNode(node.id, { width: 180, height: 80 });
  });
  
  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });
  
  dagre.layout(g);
  
  return nodes.map(node => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 90,  // Center the node
        y: nodeWithPosition.y - 40,
      },
    };
  });
}
```

### State Management

```typescript
// dashboard/stores/vizStore.ts

import { create } from 'zustand';

interface VizState {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;
  
  // Sessions
  sessions: Map<string, Session>;
  activeSessionId: string | null;
  setActiveSession: (id: string) => void;
  
  // Events
  addEvent: (event: VizEvent) => void;
  
  // UI State
  selectedEventId: string | null;
  setSelectedEvent: (id: string | null) => void;
  
  // Computed
  getActiveSession: () => Session | undefined;
  getSessionGraph: (sessionId: string) => { nodes: Node[], edges: Edge[] };
}

export const useVizStore = create<VizState>((set, get) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
  
  sessions: new Map(),
  activeSessionId: null,
  setActiveSession: (id) => set({ activeSessionId: id }),
  
  addEvent: (event) => set((state) => {
    const sessions = new Map(state.sessions);
    let session = sessions.get(event.sessionId);
    
    if (!session) {
      session = {
        id: event.sessionId,
        startTime: event.timestamp,
        status: 'active',
        events: [],
        metrics: { totalTokens: { input: 0, output: 0, total: 0 }, ... },
      };
      sessions.set(event.sessionId, session);
    }
    
    session.events.push(event);
    updateSessionMetrics(session, event);
    
    // Auto-select first session
    const activeSessionId = state.activeSessionId ?? event.sessionId;
    
    return { sessions, activeSessionId };
  }),
  
  selectedEventId: null,
  setSelectedEvent: (id) => set({ selectedEventId: id }),
  
  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return activeSessionId ? sessions.get(activeSessionId) : undefined;
  },
  
  getSessionGraph: (sessionId) => {
    const session = get().sessions.get(sessionId);
    if (!session) return { nodes: [], edges: [] };
    return buildGraph(session.events);
  },
}));
```

### WebSocket Hook

```typescript
// dashboard/hooks/useWebSocket.ts

import { useEffect, useRef } from 'react';
import { useVizStore } from '../stores/vizStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { setConnected, addEvent } = useVizStore();
  
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`ws://${window.location.host}/ws`);
      
      ws.onopen = () => {
        setConnected(true);
        console.log('Connected to viz server');
      };
      
      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as VizEvent;
          addEvent(event);
        } catch (e) {
          console.error('Failed to parse event:', e);
        }
      };
      
      ws.onclose = () => {
        setConnected(false);
        // Reconnect after delay
        setTimeout(connect, 2000);
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
      
      wsRef.current = ws;
    };
    
    connect();
    
    return () => {
      wsRef.current?.close();
    };
  }, []);
}
```

### Main App Component

```typescript
// dashboard/App.tsx

import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWebSocket } from './hooks/useWebSocket';
import { useVizStore } from './stores/vizStore';
import { SessionSidebar } from './components/SessionSidebar';
import { EventTimeline } from './components/EventTimeline';
import { MetricsPanel } from './components/MetricsPanel';
import { EventDetails } from './components/EventDetails';
import { AgentNode, ToolNode, ExecutorNode } from './components/nodes';

const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  sequential: ExecutorNode,
  parallel: ExecutorNode,
  map: ExecutorNode,
  voting: ExecutorNode,
  router: ExecutorNode,
  pipeline: ExecutorNode,
};

export function App() {
  useWebSocket();
  
  const { connected, activeSessionId, getSessionGraph, selectedEventId } = useVizStore();
  const { nodes, edges } = activeSessionId ? getSessionGraph(activeSessionId) : { nodes: [], edges: [] };
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-12 border-b flex items-center justify-between px-4">
        <h1 className="font-semibold">Agention Viz</h1>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <SessionSidebar className="w-48 border-r" />
        
        {/* Graph + Details */}
        <div className="flex-1 flex flex-col">
          {/* React Flow Graph */}
          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
          
          {/* Bottom Panel */}
          <div className="h-64 border-t flex">
            <EventTimeline className="flex-1 border-r" />
            <div className="w-80 flex flex-col">
              <MetricsPanel className="border-b" />
              {selectedEventId && <EventDetails className="flex-1" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## CLI Usage

```bash
# Install globally
npm install -g @agention/viz

# Run with defaults (port 4242)
agention-viz

# Custom port
agention-viz --port 8080

# Open browser automatically
agention-viz --open

# Show help
agention-viz --help
```

## Environment Variables (for agents)

The core `agention-lib` will check these environment variables:

```bash
# Enable visualization reporting (default: false)
AGENTION_VIZ_ENABLED=true

# Visualization server URL (default: ws://localhost:4242/ws/agent)
AGENTION_VIZ_URL=ws://localhost:4242/ws/agent

# Session name (optional, for labeling)
AGENTION_VIZ_SESSION_NAME="My Test Session"
```

## Core Library Integration (VizReporter)

The core `agention-lib` will include a `VizReporter` singleton that agents use to send events:

```typescript
// lib/viz/VizReporter.ts

import { EventEmitter } from 'events';
import WebSocket from 'ws';

class VizReporter extends EventEmitter {
  private static instance: VizReporter;
  private ws: WebSocket | null = null;
  private queue: VizEvent[] = [];
  private config: VizConfig;
  private currentSession: string | null = null;
  
  static getInstance(): VizReporter {
    if (!VizReporter.instance) {
      VizReporter.instance = new VizReporter();
    }
    return VizReporter.instance;
  }
  
  private isEnabled(): boolean {
    return process.env.AGENTION_VIZ_ENABLED === 'true';
  }
  
  private getUrl(): string {
    return process.env.AGENTION_VIZ_URL || 'ws://localhost:4242/ws/agent';
  }
  
  // Session management
  startSession(name?: string): string {
    this.currentSession = generateId();
    this.send({
      eventType: 'session.start',
      sessionId: this.currentSession,
      payload: { name: name || process.env.AGENTION_VIZ_SESSION_NAME }
    });
    return this.currentSession;
  }
  
  endSession(reason: 'completed' | 'error' | 'timeout' = 'completed'): void {
    if (this.currentSession) {
      this.send({
        eventType: 'session.end',
        sessionId: this.currentSession,
        payload: { reason }
      });
      this.currentSession = null;
    }
  }
  
  // Core send method
  send(event: Partial<VizEvent>): void {
    if (!this.isEnabled()) return;
    
    const fullEvent: VizEvent = {
      eventId: generateId(),
      sessionId: this.currentSession ?? 'default',
      timestamp: Date.now(),
      ...event
    };
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullEvent));
    } else {
      this.queue.push(fullEvent);
      this.tryConnect();
    }
  }
  
  private tryConnect(): void {
    if (this.ws) return;
    
    const ws = new WebSocket(this.getUrl());
    
    ws.on('open', () => {
      this.ws = ws;
      // Flush queue
      while (this.queue.length > 0) {
        const event = this.queue.shift();
        ws.send(JSON.stringify(event));
      }
    });
    
    ws.on('close', () => {
      this.ws = null;
      // Attempt reconnect after delay
      setTimeout(() => this.tryConnect(), 5000);
    });
    
    ws.on('error', () => {
      ws.close();
    });
  }
  
  // Typed helper methods
  agentStart(agent: BaseAgent, input: string): string {
    const eventId = generateId();
    this.send({
      eventId,
      eventType: 'agent.start',
      source: {
        agentId: agent.id,
        agentName: agent.name,
        model: agent.model,
        vendor: agent.vendor,
      },
      payload: {
        inputPreview: input.slice(0, 200),
      }
    });
    return eventId;
  }
  
  agentComplete(eventId: string, agent: BaseAgent, tokens: TokenUsage, stopReason: string, output: string): void {
    this.send({
      eventId,
      eventType: 'agent.complete',
      durationMs: /* calculate from start */,
      source: {
        agentId: agent.id,
        agentName: agent.name,
        model: agent.model,
        vendor: agent.vendor,
      },
      payload: {
        tokens,
        stopReason,
        hasToolCalls: false,
        toolCallCount: 0,
        outputPreview: output.slice(0, 200),
      }
    });
  }
  
  agentError(eventId: string, agent: BaseAgent, error: Error): void { ... }
  toolStart(tool: Tool, input: any, agentContext: { agentId: string, agentName: string }): string { ... }
  toolComplete(eventId: string, tool: Tool, result: any): void { ... }
  toolError(eventId: string, tool: Tool, error: Error): void { ... }
  pipelineStart(executor: BaseExecutor, input: any): string { ... }
  pipelineEnd(eventId: string, executor: BaseExecutor, result: any): void { ... }
  executorStart(executor: BaseExecutor, input: any, parentEventId?: string): string { ... }
  executorEnd(eventId: string, executor: BaseExecutor, result: any): void { ... }
}

export const vizReporter = VizReporter.getInstance();
```

## Testing the Package

### Manual Testing

1. Start the viz server: `npx @agention/viz --open`
2. Run a test script that sends mock events:

```typescript
// test/mock-agent.ts
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:4242/ws/agent');

ws.on('open', () => {
  const sessionId = 'test-session-1';
  
  // Send session start
  ws.send(JSON.stringify({
    eventId: 'e1',
    sessionId,
    timestamp: Date.now(),
    eventType: 'session.start',
    source: { agentId: 'a1', agentName: 'TestAgent', model: 'claude-sonnet-4-20250514', vendor: 'anthropic' },
    payload: { name: 'Test Session' },
  }));
  
  // Send agent start
  setTimeout(() => {
    ws.send(JSON.stringify({
      eventId: 'e2',
      sessionId,
      timestamp: Date.now(),
      eventType: 'agent.start',
      source: { agentId: 'a1', agentName: 'ResearchAgent', model: 'claude-sonnet-4-20250514', vendor: 'anthropic' },
      payload: { inputPreview: 'What is quantum computing?' },
    }));
  }, 100);
  
  // Send tool start
  setTimeout(() => {
    ws.send(JSON.stringify({
      eventId: 'e3',
      sessionId,
      parentEventId: 'e2',
      timestamp: Date.now(),
      eventType: 'tool.start',
      source: { agentId: 'a1', agentName: 'ResearchAgent', model: 'claude-sonnet-4-20250514', vendor: 'anthropic' },
      payload: { toolName: 'web_search', toolId: 't1', inputSummary: 'query: "quantum computing basics"' },
    }));
  }, 500);
  
  // Send tool complete
  setTimeout(() => {
    ws.send(JSON.stringify({
      eventId: 'e3',
      sessionId,
      parentEventId: 'e2',
      timestamp: Date.now(),
      eventType: 'tool.complete',
      durationMs: 450,
      source: { agentId: 'a1', agentName: 'ResearchAgent', model: 'claude-sonnet-4-20250514', vendor: 'anthropic' },
      payload: { toolName: 'web_search', toolId: 't1', success: true, resultSummary: 'Found 10 results...' },
    }));
  }, 950);
  
  // Send agent complete
  setTimeout(() => {
    ws.send(JSON.stringify({
      eventId: 'e2',
      sessionId,
      timestamp: Date.now(),
      eventType: 'agent.complete',
      durationMs: 1850,
      source: { agentId: 'a1', agentName: 'ResearchAgent', model: 'claude-sonnet-4-20250514', vendor: 'anthropic' },
      payload: {
        tokens: { input: 150, output: 500, total: 650 },
        stopReason: 'end_turn',
        hasToolCalls: true,
        toolCallCount: 1,
        outputPreview: 'Quantum computing is a type of computation that harnesses quantum mechanical phenomena...',
      },
    }));
  }, 2000);
  
  // Send session end
  setTimeout(() => {
    ws.send(JSON.stringify({
      eventId: 'e4',
      sessionId,
      timestamp: Date.now(),
      eventType: 'session.end',
      source: { agentId: 'a1', agentName: 'TestAgent', model: 'claude-sonnet-4-20250514', vendor: 'anthropic' },
      payload: { reason: 'completed' },
    }));
    ws.close();
  }, 2500);
});
```

### Pipeline Test Script

```typescript
// test/mock-pipeline.ts
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:4242/ws/agent');

ws.on('open', () => {
  const sessionId = 'pipeline-test-1';
  const pipelineId = 'p1';
  
  // Session start
  send({ eventId: 'e0', sessionId, eventType: 'session.start', payload: { name: 'Pipeline Test' } });
  
  // Pipeline start
  setTimeout(() => send({
    eventId: 'e1',
    sessionId,
    pipelineId,
    eventType: 'pipeline.start',
    payload: {
      pipelineName: 'ResearchPipeline',
      nodeType: 'pipeline',
      structure: {
        name: 'ResearchPipeline',
        type: 'pipeline',
        children: [
          { name: 'Sequential', type: 'sequential', children: [
            { name: 'Researcher', type: 'agent' },
            { name: 'FactChecker', type: 'agent' },
          ]},
          { name: 'Parallel', type: 'parallel', children: [
            { name: 'Expert1', type: 'agent' },
            { name: 'Expert2', type: 'agent' },
          ]},
          { name: 'Judge', type: 'voting', children: [
            { name: 'JudgeAgent', type: 'agent' },
          ]},
        ]
      },
      inputPreview: 'Research quantum computing applications',
    }
  }), 100);
  
  // Sequential executor start
  setTimeout(() => send({
    eventId: 'e2',
    sessionId,
    pipelineId,
    parentEventId: 'e1',
    eventType: 'executor.start',
    payload: { executorName: 'Sequential', executorType: 'sequential', childCount: 2, inputPreview: 'Research...' }
  }), 200);
  
  // Agent 1 (Researcher) start
  setTimeout(() => send({
    eventId: 'e3',
    sessionId,
    pipelineId,
    parentEventId: 'e2',
    eventType: 'agent.start',
    source: { agentId: 'researcher', agentName: 'Researcher', model: 'claude-sonnet-4-20250514', vendor: 'anthropic' },
    payload: { inputPreview: 'Research quantum computing...' }
  }), 300);
  
  // ... continue with more events for the full pipeline
});

function send(event: Partial<VizEvent>) {
  ws.send(JSON.stringify({
    timestamp: Date.now(),
    source: event.source || { agentId: 'system', agentName: 'System', model: 'n/a', vendor: 'anthropic' },
    ...event,
  }));
}
```

## Key Implementation Notes

1. **No persistence** - Everything is in-memory. Sessions are cleared on server restart. This is intentional for simplicity.

2. **Performance** - Keep the event store efficient. With many events, the graph builder should be memoized.

3. **Reconnection** - Both dashboard and agents should auto-reconnect on disconnect.

4. **Event ordering** - Events may arrive slightly out of order. Use `timestamp` for sorting in timeline, but `parentEventId` for graph structure.

5. **Node sizing** - React Flow needs to know node dimensions for layout. Use consistent sizes or measure rendered nodes.

6. **Real-time updates** - The graph should update live as events arrive. Use React Flow's controlled mode with state updates.

7. **Edge cases**:
   - Agent without a session (create default session)
   - Pipeline events without structure (show flat list)
   - Duplicate events (dedupe by eventId)
   - Very long sessions (consider pagination/virtualization)

## Dependencies

### Server
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "commander": "^11.1.0",
    "open": "^9.1.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.0"
  }
}
```

### Dashboard
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@xyflow/react": "^12.0.0",
    "zustand": "^4.4.7",
    "dagre": "^0.8.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/dagre": "^0.7.52",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.3.0"
  }
}
```
