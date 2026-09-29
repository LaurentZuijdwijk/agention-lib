/**
 * Tetris played by a fast classifier — in the browser, two players racing.
 *
 * The same game as `examples/jev-tetris.ts`, served as a web page: two boards
 * play the same seeded piece sequence side by side, each driven by a player
 * of your choice (Jev, Qwen on Cerebras, Claude or the offline heuristic). Every move shows the
 * placements the player weighed, drawn as ghosts on the board, with the
 * probability the classifier gave each one.
 *
 * API keys stay on this server; the page only receives the moves, streamed
 * over server-sent events.
 *
 * Run with:
 *   OPENROUTER_API_KEY=... CEREBRAS_API_KEY=... npx tsx examples/jev-tetris-web.ts
 * then open http://localhost:3000 (set PORT to change it).
 *
 * The page is laid out for a 16:9 screen recording: press Space to start a
 * timed race (3-2-1 countdown, then the clock), S for settings. URL params
 * preset it, e.g. /?left=jev&right=cerebras&seconds=60&seed=42
 */
import { readFileSync } from "node:fs";
import { createServer, ServerResponse } from "node:http";
import { join } from "node:path";
import {
  PLAYERS,
  emptyBoard,
  pieceSequence,
  placementsFor,
  requestFor,
  statsOf,
} from "./tetris/game";

const PORT = Number(process.env.PORT ?? 3000);
const PAGE = join(__dirname, "tetris", "index.html");
/** How many candidate placements each move reports to the page. */
const TOP_CANDIDATES = 5;

/** Which players this server has the keys to run. */
function availablePlayers(): Record<string, boolean> {
  return {
    jev: Boolean(process.env.TYPESAFE_API_KEY || process.env.OPENROUTER_API_KEY),
    cerebras: Boolean(process.env.CEREBRAS_API_KEY),
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    heuristic: true,
  };
}

function send(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Plays one game and streams every move to `res` until it ends or the page leaves. */
async function streamGame(
  res: ServerResponse,
  params: URLSearchParams,
  isClosed: () => boolean
): Promise<void> {
  const playerName = params.get("player") ?? "jev";
  const seed = Number(params.get("seed") ?? 42);
  const pieces = Math.min(Number(params.get("pieces") ?? 100), 1000);
  const minMoveMs = Number(params.get("delay") ?? 0);

  if (!PLAYERS[playerName] || !availablePlayers()[playerName]) {
    send(res, "failed", { message: `Player "${playerName}" is not available on this server.` });
    return;
  }

  const play = PLAYERS[playerName]();
  const nextPiece = pieceSequence(seed);
  let board = emptyBoard();
  let current = nextPiece();
  let upcoming = nextPiece();
  let lines = 0;
  let placed = 0;
  let tokens = 0;
  let costUsd: number | undefined;

  while (placed < pieces && !isClosed()) {
    const placements = placementsFor(board, current);
    if (placements.length === 0) break;

    const started = performance.now();
    const result = await play(
      requestFor(board, placements, current, upcoming, lines),
      placements
    );
    const ms = performance.now() - started;
    if (isClosed()) return;

    const chosen = placements.find((p) => p.label === result.choice) ?? placements[0];
    const probabilities = result.probabilities ?? {};
    const candidates = [...placements]
      .sort(
        (a, b) =>
          (probabilities[b.label] ?? 0) - (probabilities[a.label] ?? 0) ||
          Number(b === chosen) - Number(a === chosen)
      )
      .slice(0, TOP_CANDIDATES)
      .map((p) => ({
        label: p.label,
        probability: probabilities[p.label],
        cells: p.cells,
        description: p.description,
      }));

    const before = board;
    board = chosen.board;
    lines += chosen.linesCleared;
    placed++;
    tokens += result.tokens ?? 0;
    if (result.costUsd !== undefined) costUsd = (costUsd ?? 0) + result.costUsd;

    send(res, "move", {
      n: placed,
      piece: current,
      next: upcoming,
      before,
      board,
      chosen: chosen.label,
      cells: chosen.cells,
      linesCleared: chosen.linesCleared,
      optionCount: placements.length,
      candidates,
      confidence: result.confidence,
      ms,
      lines,
      holes: chosen.stats.holes,
      height: chosen.stats.maxHeight,
      tokens,
      costUsd,
    });

    current = upcoming;
    upcoming = nextPiece();
    if (minMoveMs > ms) await new Promise((r) => setTimeout(r, minMoveMs - ms));
  }

  if (!isClosed()) {
    send(res, "end", {
      placed,
      lines,
      toppedOut: placed < pieces,
      holes: statsOf(board).holes,
      costUsd,
    });
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(readFileSync(PAGE));
    return;
  }

  if (url.pathname === "/api/players") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(availablePlayers()));
    return;
  }

  if (url.pathname === "/api/game") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    let closed = false;
    req.on("close", () => {
      closed = true;
    });
    streamGame(res, url.searchParams, () => closed)
      .catch((error) => {
        if (!closed) send(res, "failed", { message: (error as Error).message });
      })
      .finally(() => res.end());
    return;
  }

  res.writeHead(404).end();
});

server.listen(PORT, () => {
  const players = Object.entries(availablePlayers())
    .map(([name, ok]) => `${name}${ok ? "" : " (no API key)"}`)
    .join(", ");
  console.log(`Jev Tetris on http://localhost:${PORT} — players: ${players}`);
});
