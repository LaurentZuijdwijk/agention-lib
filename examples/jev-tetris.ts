/**
 * Tetris played by a fast classifier.
 *
 * Each time a piece arrives, the game lists every legal placement (rotation ×
 * column, hard-dropped) and asks the player to pick one. That is exactly a
 * classifier's job — choose one of N labeled options — so TypeSafe AI's Jev
 * plays through the plain `Classifier` interface: the board is the
 * `context`, the placements are the `options`, and each placement's outcome
 * (lines cleared, new holes, stack height, bumpiness) is its entry in
 * `optionDescriptions`. Weighing those outcomes against each other is left to
 * the player.
 *
 * Every player sees the same seeded piece sequence, so the scores are directly
 * comparable:
 *   --player jev        Jev via JevClassifier (needs TYPESAFE_API_KEY or OPENROUTER_API_KEY)
 *   --player cerebras   Qwen 3.8 27B on Cerebras, thinking off (needs CEREBRAS_API_KEY)
 *   --player claude     Claude Haiku 4.5 picking from the same options (needs ANTHROPIC_API_KEY)
 *   --player heuristic  A hand-tuned scoring rule; runs offline, as a baseline
 *
 * Run with:
 *   TYPESAFE_API_KEY=... npx tsx examples/jev-tetris.ts --player jev
 *   OPENROUTER_API_KEY=... npx tsx examples/jev-tetris.ts --player jev
 *
 * Other flags: --pieces 100  --seed 42  --delay 0  --quiet
 */
import {
  PLAYERS,
  WIDTH,
  emptyBoard,
  pieceSequence,
  placementsFor,
  renderBoard,
  requestFor,
  statsOf,
} from "./tetris/game";

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------

function parseArgs(): {
  player: string;
  pieces: number;
  seed: number;
  delay: number;
  quiet: boolean;
} {
  const args = process.argv.slice(2);
  const value = (flag: string, fallback: string): string => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  return {
    player: value("--player", "jev"),
    pieces: Number(value("--pieces", "100")),
    seed: Number(value("--seed", "42")),
    delay: Number(value("--delay", "0")),
    quiet: args.includes("--quiet"),
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main(): Promise<void> {
  const options = parseArgs();
  if (!PLAYERS[options.player]) {
    throw new Error(`Unknown --player "${options.player}". Use jev, claude or heuristic.`);
  }
  const play = PLAYERS[options.player]();
  const nextPiece = pieceSequence(options.seed);
  const live = !options.quiet && process.stdout.isTTY;

  let board = emptyBoard();
  let current = nextPiece();
  let upcoming = nextPiece();
  let lines = 0;
  let placed = 0;
  let tokens = 0;
  let costUsd: number | undefined;
  let lowConfidence = 0;
  const latencies: number[] = [];
  const confidences: number[] = [];
  const clears = [0, 0, 0, 0, 0];

  while (placed < options.pieces) {
    const placements = placementsFor(board, current);
    if (placements.length === 0) break; // the piece cannot enter the board

    const request = requestFor(board, placements, current, upcoming, lines);

    const started = performance.now();
    const result = await play(request, placements);
    const elapsed = performance.now() - started;
    latencies.push(elapsed);
    if (result.confidence !== undefined) {
      confidences.push(result.confidence);
      if (result.confidence < 0.5) lowConfidence++;
    }
    tokens += result.tokens ?? 0;
    if (result.costUsd !== undefined) costUsd = (costUsd ?? 0) + result.costUsd;

    const chosen = placements.find((p) => p.label === result.choice) ?? placements[0];
    board = chosen.board;
    lines += chosen.linesCleared;
    clears[chosen.linesCleared]++;
    placed++;

    if (live) {
      const confidence =
        result.confidence !== undefined ? `${(result.confidence * 100).toFixed(0)}%` : "n/a";
      const stats = [
        `player      ${options.player}`,
        `piece       #${placed} ${current} (next ${upcoming})`,
        `placement   ${chosen.label} of ${placements.length} options`,
        `confidence  ${confidence}`,
        `decision    ${elapsed.toFixed(0)} ms`,
        `lines       ${lines}`,
        `holes       ${chosen.stats.holes}`,
      ];
      const rows = renderBoard(board);
      const frame = rows.map((row, i) => `|${row}|   ${stats[i] ?? ""}`);
      process.stdout.write(
        "\x1b[2J\x1b[H" + frame.join("\n") + `\n+${"-".repeat(WIDTH * 2 - 1)}+\n`
      );
      if (options.delay > 0) await new Promise((r) => setTimeout(r, options.delay));
    }

    current = upcoming;
    upcoming = nextPiece();
  }

  const gameOver = placed < options.pieces;
  const averageConfidence =
    confidences.length > 0
      ? `${((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100).toFixed(0)}%`
      : "n/a";
  console.log(`\n=== ${options.player} — seed ${options.seed} ===`);
  console.log(`result           ${gameOver ? `topped out after ${placed} pieces` : `survived all ${placed} pieces`}`);
  console.log(`lines cleared    ${lines} (singles ${clears[1]}, doubles ${clears[2]}, triples ${clears[3]}, tetrises ${clears[4]})`);
  console.log(`final holes      ${statsOf(board).holes}`);
  console.log(`decision time    median ${percentile(latencies, 50).toFixed(0)} ms, p95 ${percentile(latencies, 95).toFixed(0)} ms`);
  console.log(`confidence       average ${averageConfidence}, below 50% on ${lowConfidence} moves`);
  if (tokens > 0) console.log(`tokens           ${tokens}`);
  console.log(
    `cost             ${costUsd === undefined ? "not reported by this provider" : `$${costUsd.toFixed(4)} ($${((costUsd / Math.max(placed, 1)) * 1000).toFixed(3)} per 1,000 moves)`}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
