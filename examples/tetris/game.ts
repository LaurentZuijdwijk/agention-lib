/**
 * Shared Tetris engine and players for `examples/jev-tetris.ts` (terminal)
 * and `examples/jev-tetris-web.ts` (browser). See those files for how to run.
 */
import { BaseAgent } from "../../lib/agents/BaseAgent";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import {
  OpenAICompatibleAgent,
  OpenAICompatibleConfig,
} from "../../lib/agents/openai-compatible/OpenAICompatibleAgent";
import {
  ClassifyRequest,
  ClassifyResult,
  JevClassifier,
} from "../../lib/classifiers";

// ---------------------------------------------------------------------------
// Game engine
// ---------------------------------------------------------------------------

export const WIDTH = 10;
export const HEIGHT = 20;

export type Cell = [x: number, y: number];
/** Row 0 is the top. An empty cell is "."; a filled one holds its piece letter. */
export type Board = string[][];

export const PIECE_SHAPES: Record<string, Cell[]> = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

/** Shifts a shape so its minimum x and y are 0. */
export function normalize(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]): Cell => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** The distinct rotations of a piece (1 for O, 2 for I/S/Z, 4 otherwise). */
export function rotationsOf(piece: string): Cell[][] {
  const rotations: Cell[][] = [];
  const seen = new Set<string>();
  let cells = normalize(PIECE_SHAPES[piece]);
  for (let r = 0; r < 4; r++) {
    const key = JSON.stringify(cells);
    if (!seen.has(key)) {
      seen.add(key);
      rotations.push(cells);
    }
    cells = normalize(cells.map(([x, y]): Cell => [y, -x]));
  }
  return rotations;
}

export const ROTATIONS: Record<string, Cell[][]> = Object.fromEntries(
  Object.keys(PIECE_SHAPES).map((piece) => [piece, rotationsOf(piece)])
);

/** Deterministic RNG (mulberry32), so every player gets the same pieces. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Modern "7-bag" randomizer: each run of 7 pieces holds one of each. */
export function pieceSequence(seed: number): () => string {
  const random = seededRandom(seed);
  let bag: string[] = [];
  return () => {
    if (bag.length === 0) {
      bag = Object.keys(PIECE_SHAPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };
}

export function emptyBoard(): Board {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill("."));
}

export function fits(board: Board, cells: Cell[], dx: number, dy: number): boolean {
  return cells.every(([x, y]) => {
    const bx = x + dx;
    const by = y + dy;
    return bx >= 0 && bx < WIDTH && by >= 0 && by < HEIGHT && board[by][bx] === ".";
  });
}

export interface BoardStats {
  holes: number;
  maxHeight: number;
  bumpiness: number;
}

export function statsOf(board: Board): BoardStats {
  const heights: number[] = [];
  let holes = 0;
  for (let x = 0; x < WIDTH; x++) {
    let top = HEIGHT;
    for (let y = 0; y < HEIGHT; y++) {
      if (board[y][x] !== ".") {
        top = Math.min(top, y);
      } else if (top < y) {
        holes++;
      }
    }
    heights.push(HEIGHT - top);
  }
  let bumpiness = 0;
  for (let x = 1; x < WIDTH; x++) {
    bumpiness += Math.abs(heights[x] - heights[x - 1]);
  }
  return { holes, maxHeight: Math.max(...heights), bumpiness };
}

export interface Placement {
  label: string;
  /** Where the piece's four cells land, before any lines clear. */
  cells: Cell[];
  rotation: number;
  column: number;
  board: Board;
  linesCleared: number;
  newHoles: number;
  stats: BoardStats;
  description: string;
}

/**
 * Every distinct result of hard-dropping `piece` from the top, in each
 * rotation and column. No slides or tucks under overhangs, which keeps the
 * option list to at most 34 entries.
 */
export function placementsFor(board: Board, piece: string): Placement[] {
  const before = statsOf(board);
  const placements: Placement[] = [];
  const seen = new Set<string>();

  ROTATIONS[piece].forEach((cells, rotation) => {
    const width = Math.max(...cells.map(([x]) => x)) + 1;
    for (let column = 0; column + width <= WIDTH; column++) {
      if (!fits(board, cells, column, 0)) continue;
      let y = 0;
      while (fits(board, cells, column, y + 1)) y++;

      const landedCells = cells.map(([cx, cy]): Cell => [cx + column, cy + y]);
      const landed = board.map((row) => [...row]);
      for (const [cx, cy] of cells) landed[cy + y][cx + column] = piece;
      const kept = landed.filter((row) => row.includes("."));
      const linesCleared = HEIGHT - kept.length;
      const next = [
        ...Array.from({ length: linesCleared }, () => Array(WIDTH).fill(".")),
        ...kept,
      ];

      const key = next.map((row) => row.join("")).join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const stats = statsOf(next);
      const newHoles = Math.max(0, stats.holes - before.holes);
      placements.push({
        label: `r${rotation}c${column}`,
        cells: landedCells,
        rotation,
        column,
        board: next,
        linesCleared,
        newHoles,
        stats,
        description:
          `rotation ${rotation}, leftmost column ${column}: ` +
          `clears ${linesCleared} line${linesCleared === 1 ? "" : "s"}, ` +
          `creates ${newHoles} new hole${newHoles === 1 ? "" : "s"}, ` +
          `stack height ${stats.maxHeight}/${HEIGHT}, ` +
          `surface bumpiness ${stats.bumpiness}`,
      });
    }
  });
  return placements;
}

export function renderBoard(board: Board): string[] {
  return board.map((row) => row.join(" "));
}

// ---------------------------------------------------------------------------
// Players — each picks one placement label from a ClassifyRequest
// ---------------------------------------------------------------------------

export type Player = (
  request: ClassifyRequest,
  placements: Placement[]
) => Promise<ClassifyResult & { tokens?: number; costUsd?: number }>;

/** USD per million tokens, for providers whose API reports tokens but not cost. */
interface Pricing {
  input: number;
  output: number;
}

/** Claude Haiku 4.5 list price. */
const CLAUDE_MODEL = "claude-haiku-4-5";
const CLAUDE_PRICING: Pricing = { input: 1, output: 5 };

/** Cerebras list price for Qwen 3.8 27B (cerebras.ai/pricing, 2026-09-29). */
const CEREBRAS_MODEL = "qwen-3.8-27b";
const CEREBRAS_PRICING: Pricing = { input: 0.99, output: 1.49 };

export const QUESTION =
  "You are playing Tetris. Which placement of the current piece is best? " +
  "Clear lines when possible, avoid creating holes, and keep the stack low " +
  "and flat so the game can go on as long as possible.";

/**
 * Jev straight from TypeSafe, or through OpenRouter — which serves the same
 * model on its System One API, billed to the OpenRouter account.
 */
export function jevPlayer(): Player {
  const typesafeKey = process.env.TYPESAFE_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!typesafeKey && !openRouterKey) {
    throw new Error("Set TYPESAFE_API_KEY or OPENROUTER_API_KEY to play with Jev");
  }
  const jev = typesafeKey
    ? new JevClassifier({ apiKey: typesafeKey, model: "jev-latest" })
    : new JevClassifier({
        apiKey: openRouterKey,
        baseURL: "https://openrouter.ai/api",
        model: "jev-latest",
      });
  return async (request) => {
    const result = await jev.classify(request);
    // OpenRouter reports what each call cost; TypeSafe's own API may not.
    const cost = (result.raw as { usage?: { cost?: number } } | undefined)?.usage?.cost;
    return { ...result, costUsd: typeof cost === "number" ? cost : undefined };
  };
}

/**
 * Cerebras through its OpenAI-compatible endpoint, with reasoning off
 * (`reasoning_effort: "none"`) — a fast LLM answers the same question as a
 * plain chat completion.
 */
class CerebrasAgent extends OpenAICompatibleAgent {
  constructor(config: Omit<OpenAICompatibleConfig, "baseURL" | "vendor">) {
    super({ ...config, vendor: "llamacpp", baseURL: "https://api.cerebras.ai/v1" });
  }

  protected getVendorName(): string {
    return "Cerebras";
  }

  protected buildExtraRequestParams(): Record<string, unknown> {
    return { reasoning_effort: "none" };
  }
}

/**
 * Any chat agent as a player: the same question, state and options as the
 * classifier gets, sent as a prompt, with the label parsed out of the reply.
 */
function llmPlayer(agent: BaseAgent, pricing: Pricing): Player {
  return async (request) => {
    const prompt = [
      QUESTION,
      "",
      "Game state:",
      JSON.stringify(request.context, null, 2),
      "",
      "Options:",
      ...request.options.map(
        (option) => `- ${option}: ${request.optionDescriptions?.[option]}`
      ),
      "",
      "Respond with ONLY the option label, e.g. r0c3.",
    ].join("\n");

    const response = String(await agent.execute(prompt)).trim();
    // Same fallback idea as RouterExecutor's parser: accept the label even
    // when the model wraps it in extra words.
    const choice =
      request.options.find((option) => response === option) ??
      request.options.find((option) => response.includes(option)) ??
      request.options[0];
    const usage = agent.lastTokenUsage;
    return {
      choice,
      raw: response,
      tokens: usage ? usage.input_tokens + usage.output_tokens : undefined,
      costUsd: usage
        ? (usage.input_tokens * pricing.input + usage.output_tokens * pricing.output) /
          1_000_000
        : undefined,
    };
  };
}

export function claudePlayer(): Player {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is required");
  const agent = new ClaudeAgent({
    id: "tetris-claude",
    name: "Tetris Player",
    description: "Picks Tetris placements.",
    model: CLAUDE_MODEL,
    apiKey,
  });
  return llmPlayer(agent, CLAUDE_PRICING);
}

export function cerebrasPlayer(): Player {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("CEREBRAS_API_KEY environment variable is required");
  const agent = new CerebrasAgent({
    id: "tetris-cerebras",
    name: "Tetris Player",
    description: "Picks Tetris placements.",
    model: CEREBRAS_MODEL,
    apiKey,
  });
  return llmPlayer(agent, CEREBRAS_PRICING);
}

/** A classic weighted scoring rule over the same facts the other players see. */
export function heuristicPlayer(): Player {
  return async (_request, placements) => {
    const score = (p: Placement): number =>
      p.linesCleared * 8 - p.newHoles * 7.5 - p.stats.maxHeight * 0.5 - p.stats.bumpiness * 0.2;
    const best = placements.reduce((a, b) => (score(b) > score(a) ? b : a));
    return { choice: best.label, costUsd: 0 };
  };
}

/** The classification request the game sends for one move. */
export function requestFor(
  board: Board,
  placements: Placement[],
  current: string,
  upcoming: string,
  linesCleared: number
): ClassifyRequest {
  return {
    context: {
      board: renderBoard(board),
      currentPiece: current,
      nextPiece: upcoming,
      linesCleared,
    },
    question: QUESTION,
    options: placements.map((p) => p.label),
    optionDescriptions: Object.fromEntries(
      placements.map((p) => [p.label, p.description])
    ),
  };
}

export const PLAYERS: Record<string, () => Player> = {
  jev: jevPlayer,
  cerebras: cerebrasPlayer,
  claude: claudePlayer,
  heuristic: heuristicPlayer,
};
