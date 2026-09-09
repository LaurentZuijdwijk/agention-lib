/**
 * Stand-in for https://chatgpt.com/backend-api/codex, for running
 * `examples/openai-oauth.ts` without a ChatGPT account.
 *
 * Enforces the validations the real backend is reported to apply and logs every
 * header and body field it receives, so a request that satisfies this one is
 * wire-correct. Streams SSE back the way the Responses API does, and answers a
 * tool round trip on the third call.
 *
 *   npx tsx examples/mock-codex-backend.ts
 *
 *   CODEX_ACCESS_TOKEN=mock CODEX_ACCOUNT_ID=acct-1 \
 *     CODEX_BASE_URL=http://localhost:8123 npx tsx examples/openai-oauth.ts
 *
 * Set `CODEX_MODEL=reject-me` to see how a rejection is reported.
 */
import * as http from "http";

const PORT = Number(process.env.PORT ?? 8123);
let call = 0;

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    console.log(`\n[mock] ${req.method} ${req.url}`);
    console.log("[mock] headers:");
    for (const k of [
      "authorization",
      "chatgpt-account-id",
      "openai-beta",
      "originator",
      "accept",
      "content-type",
    ]) {
      const v = req.headers[k];
      console.log(
        `  ${k}: ${
          k === "authorization" && typeof v === "string"
            ? v.slice(0, 14) + "…"
            : (v ?? "\x1b[31m(missing)\x1b[0m")
        }`
      );
    }

    const fail = (detail: string) => {
      console.log(`[mock] \x1b[31mREJECT 400: ${detail}\x1b[0m`);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail }));
    };

    // The models endpoint, which the real backend 400s without a client_version.
    if ((req.url ?? "").startsWith("/models")) {
      if (!/[?&]client_version=/.test(req.url ?? "")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error: { message: "Field required: client_version" },
          })
        );
      }
      console.log("[mock] \x1b[32mACCEPT\x1b[0m /models");
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          models: [
            {
              slug: "gpt-5.6-luna",
              display_name: "GPT-5.6-Luna",
              description: "Fast and affordable agentic coding model.",
              context_window: 272000,
              max_context_window: 872000,
              input_modalities: ["text", "image"],
              supported_reasoning_levels: [
                { effort: "low" },
                { effort: "medium" },
                { effort: "high" },
                { effort: "xhigh" },
                { effort: "max" },
              ],
              default_reasoning_level: "medium",
              minimal_client_version: "0.144.0",
            },
          ],
        })
      );
    }

    if (!/\/responses$/.test(req.url ?? "")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ detail: "Not Found" }));
    }
    if (!req.headers.authorization?.startsWith("Bearer ")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ detail: "Missing bearer token" }));
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("Invalid JSON");
    }

    console.log(
      "[mock] body keys:",
      Object.keys(body).sort().join(", ")
    );
    console.log(
      `[mock] instructions: ${JSON.stringify(String(body.instructions).slice(0, 60))}`
    );
    console.log(`[mock] store=${body.store} stream=${body.stream}`);
    console.log(
      `[mock] input roles: ${(body.input ?? [])
        .map((i: any) => i.role ?? i.type)
        .join(", ")}`
    );

    // Escape hatch for testing error reporting on an otherwise valid request.
    if (body.model === "reject-me") return fail("Model not supported");

    // The four documented 400s, in the real backend's order.
    if (typeof body.instructions !== "string" || !body.instructions.trim())
      return fail("Instructions are required");
    if (!Array.isArray(body.input)) return fail("Input must be a list");
    if (body.store !== false) return fail("Store must be set to false");
    if (body.stream !== true) return fail("Stream must be set to true");
    // The real backend takes instructions as the system prompt; a system item
    // in `input` would be a duplicate. Flagged loudly so the test catches it.
    if (body.input.some((i: any) => i.role === "system"))
      return fail("Unexpected system message in input");

    console.log("[mock] \x1b[32mACCEPT\x1b[0m");

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (event: any) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    call += 1;
    const wantsTool =
      call === 3 &&
      Array.isArray(body.tools) &&
      body.tools.some((t: any) => t.name === "get_time");

    const output = wantsTool
      ? [
          {
            type: "function_call",
            id: "fc_mock1",
            call_id: "call_mock1",
            name: "get_time",
            arguments: "{}",
            status: "completed",
          },
        ]
      : [
          {
            type: "message",
            id: "msg_mock",
            status: "completed",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: wantsTool ? "" : mockText(call),
                annotations: [],
              },
            ],
          },
        ];

    const response = {
      id: `resp_mock_${call}`,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model: body.model,
      output,
      output_text: wantsTool ? "" : mockText(call),
      usage: {
        input_tokens: 42,
        output_tokens: 17,
        total_tokens: 59,
      },
    };

    send({ type: "response.created", response: { ...response, status: "in_progress", output: [] } });

    if (!wantsTool) {
      // Stream the text out in fragments, as the real API does.
      const text = mockText(call);
      let acc = "";
      for (const word of text.split(" ")) {
        acc += (acc ? " " : "") + word;
        send({
          type: "response.output_text.delta",
          item_id: "msg_mock",
          output_index: 0,
          content_index: 0,
          delta: (acc === word ? "" : " ") + word,
        });
      }
    }

    send({ type: "response.completed", response });
    res.end();
  });
});

function mockText(n: number): string {
  return n === 1
    ? "A monad is a design pattern for chaining computations that carry context."
    : n === 2
      ? "Context flows through / each computation in turn / bound, never unwrapped"
      : "According to the tool, the time is now.";
}

server.listen(PORT, () => {
  console.log(`[mock] Codex backend listening on http://localhost:${PORT}`);
});
