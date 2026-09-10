// @ts-nocheck
import OpenAI from "openai";
import { CodexAgent } from "./CodexAgent";
import { OpenAiAgent } from "./OpenAiAgent";
import { ExecutionError } from "../errors/AgentError";
import { AgentEvent } from "../AgentEvent";

jest.mock("openai");

describe("CodexAgent", () => {
  let mockClient: any;

  const agentConfig = (over = {}) => ({
    id: "c",
    name: "CodexAgent",
    description: "d",
    apiKey: "chatgpt-access-token",
    accountId: "acct-123",
    ...over,
  });

  /** A stream yielding one completed response, as the Codex backend sends it. */
  const completedStream = (text = "Hi there") =>
    (async function* () {
      yield {
        type: "response.output_item.done",
        item: {
          type: "message",
          status: "completed",
          role: "assistant",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      };
      yield {
        type: "response.completed",
        response: {
          id: "resp_1",
          // The backend really does send an empty output here — the content
          // only ever arrives as output_item.done events.
          output: [],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        },
      };
    })();

  beforeEach(() => {
    jest.resetAllMocks();
    mockClient = {
      responses: { create: jest.fn() },
      models: { list: jest.fn() },
    };
    (OpenAI as jest.Mock).mockImplementation(() => mockClient);
  });

  describe("client construction", () => {
    it("targets the Codex endpoint with its required headers", () => {
      new CodexAgent(agentConfig());

      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "chatgpt-access-token",
          baseURL: "https://chatgpt.com/backend-api/codex",
          defaultHeaders: expect.objectContaining({
            "chatgpt-account-id": "acct-123",
            "OpenAI-Beta": "responses=experimental",
            originator: "codex_cli_rs",
            Accept: "text/event-stream",
          }),
          // Needed because the SDK discards this backend's `{detail: …}` bodies.
          fetch: expect.any(Function),
        })
      );
    });

    it("defaults to a model this backend actually serves", () => {
      const agent = new CodexAgent(agentConfig());
      expect(agent["config"].model).toBe("gpt-5.6-luna");
    });

    it("accepts an async apiKey function for token refresh", () => {
      const getToken = async () => "fresh";
      new CodexAgent(agentConfig({ apiKey: getToken }));

      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: getToken })
      );
    });

    it("omits chatgpt-account-id when no account id is configured", () => {
      new CodexAgent(agentConfig({ accountId: undefined }));

      expect(
        (OpenAI as jest.Mock).mock.calls.at(-1)[0].defaultHeaders
      ).not.toHaveProperty("chatgpt-account-id");
    });

    it("lets the caller override a header", () => {
      new CodexAgent(agentConfig({ defaultHeaders: { originator: "mine" } }));

      expect(
        (OpenAI as jest.Mock).mock.calls.at(-1)[0].defaultHeaders.originator
      ).toBe("mine");
    });

    it("keeps the Codex shape on a custom baseURL, as a proxy needs", async () => {
      mockClient.responses.create.mockResolvedValue(completedStream());

      const agent = new CodexAgent(
        agentConfig({ baseURL: "http://localhost:8123" })
      );
      await agent.execute("Hello");

      expect((OpenAI as jest.Mock).mock.calls.at(-1)[0].baseURL).toBe(
        "http://localhost:8123"
      );
      expect(mockClient.responses.create.mock.calls[0][0].stream).toBe(true);
    });
  });

  describe("request shape", () => {
    it("satisfies every documented body validation", async () => {
      mockClient.responses.create.mockResolvedValue(completedStream());

      const agent = new CodexAgent(agentConfig({ maxTokens: 500 }));
      const systemMessage = agent["history"].getSystemMessage();

      const result = await agent.execute("Hello");

      const body = mockClient.responses.create.mock.calls[0][0];
      expect(body.instructions).toBe(systemMessage);
      expect(body.instructions).toBeTruthy();
      expect(body.store).toBe(false);
      expect(body.stream).toBe(true);
      expect(Array.isArray(body.input)).toBe(true);
      // "Unsupported parameter: max_output_tokens" — dropped even though
      // maxTokens was set.
      expect(body).not.toHaveProperty("max_output_tokens");
      // The prompt travels in `instructions`; a copy in `input` is a duplicate.
      expect(body.input.some((i: any) => i.role === "system")).toBe(false);
      expect(body.input.some((i: any) => i.role === "user")).toBe(true);

      expect(result).toBe("Hi there");
    });

    it("rebuilds output from streamed items when the terminal event is empty", async () => {
      mockClient.responses.create.mockResolvedValue(completedStream("Rebuilt"));

      const agent = new CodexAgent(agentConfig());

      // Without the repair this returns "" — the terminal event's output is [].
      expect(await agent.execute("Hello")).toBe("Rebuilt");
    });

    it("recovers tool calls that only appear as streamed items", async () => {
      mockClient.responses.create.mockResolvedValueOnce(
        (async function* () {
          yield {
            type: "response.output_item.done",
            item: {
              type: "function_call",
              id: "fc_1",
              call_id: "call_1",
              name: "get_time",
              arguments: "{}",
              status: "completed",
            },
          };
          yield {
            type: "response.completed",
            response: { id: "r1", output: [], usage: {} },
          };
        })()
      );
      mockClient.responses.create.mockResolvedValueOnce(
        completedStream("It is noon")
      );

      const agent = new CodexAgent(agentConfig());
      agent.addTools([
        {
          getPrompt: () => ({
            name: "get_time",
            description: "time",
            input_schema: { type: "object", properties: {}, required: [] },
          }),
          getName: () => "get_time",
          execute: jest.fn().mockResolvedValue("noon"),
        } as any,
      ]);

      expect(await agent.execute("What time is it?")).toBe("It is noon");
      // Two hops: the tool call, then the answer.
      expect(mockClient.responses.create).toHaveBeenCalledTimes(2);
    });

    it("throws when the stream ends with no terminal event", async () => {
      mockClient.responses.create.mockResolvedValue(
        (async function* () {
          yield { type: "response.created", response: { id: "r" } };
        })()
      );

      await expect(new CodexAgent(agentConfig()).execute("Hello")).rejects.toThrow(
        /without a terminal response event/
      );
    });
  });

  describe("listModels", () => {
    const card = {
      slug: "gpt-5.6-luna",
      display_name: "GPT-5.6-Luna",
      context_window: 272000,
      max_context_window: 872000,
      input_modalities: ["text", "image"],
      supported_reasoning_levels: [{ effort: "low" }, { effort: "max" }],
    };

    it("reads the Codex models endpoint and normalizes the cards", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [card] }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const models = await new CodexAgent(agentConfig()).listModels();

      const [url, init] = fetchMock.mock.calls[0];
      // The endpoint 400s without a client_version.
      expect(url).toContain("/models?client_version=");
      expect(init.headers["chatgpt-account-id"]).toBe("acct-123");
      expect(init.headers.Authorization).toBe("Bearer chatgpt-access-token");

      expect(models).toEqual([
        {
          id: "gpt-5.6-luna",
          displayName: "GPT-5.6-Luna",
          contextLength: 272000,
          capabilities: {
            chat: true,
            tools: true,
            vision: true,
            thinking: true,
          },
          raw: card,
        },
      ]);
    });

    it("resolves a function apiKey before calling out", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await new CodexAgent(
        agentConfig({ apiKey: async () => "refreshed-token" })
      ).listModels();

      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer refreshed-token"
      );
    });

    it("honours a configured clientVersion", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await new CodexAgent(agentConfig({ clientVersion: "9.9.9" })).listModels();

      expect(fetchMock.mock.calls[0][0]).toContain("client_version=9.9.9");
    });

    it("wraps a failure in an ExecutionError with the body", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => '{"detail":"token expired"}',
      }) as unknown as typeof fetch;

      await expect(new CodexAgent(agentConfig()).listModels()).rejects.toThrow(
        ExecutionError
      );
      await expect(new CodexAgent(agentConfig()).listModels()).rejects.toThrow(
        /401 Unauthorized.*token expired/
      );
    });
  });

  describe("fromCredentials", () => {
    it("wires the token provider and account id from the credentials", () => {
      const agent = CodexAgent.fromCredentials(
        {
          accessToken: "at-1",
          refreshToken: "rt-1",
          accountId: "acct-from-creds",
        },
        { id: "1", name: "A", description: "d" }
      );

      expect(agent).toBeInstanceOf(CodexAgent);
      const opts = (OpenAI as jest.Mock).mock.calls.at(-1)[0];
      expect(opts.defaultHeaders["chatgpt-account-id"]).toBe("acct-from-creds");
      // The function form, so the SDK re-resolves it per request.
      expect(typeof opts.apiKey).toBe("function");
    });
  });

  describe("quota tracking", () => {
    /** The `x-codex-*` headers the backend sends on every /responses call. */
    const quotaHeaders = (overrides: Record<string, string> = {}) =>
      new Headers({
        "x-codex-plan-type": "plus",
        "x-codex-active-limit": "premium",
        "x-codex-primary-used-percent": "7",
        "x-codex-primary-window-minutes": "300",
        "x-codex-secondary-used-percent": "49",
        "x-codex-secondary-window-minutes": "10080",
        "x-codex-credits-balance": "0",
        ...overrides,
      });

    const realFetch = global.fetch;
    afterEach(() => {
      global.fetch = realFetch;
    });

    /**
     * Build an agent whose network calls answer with `responses`, in order.
     *
     * `global.fetch` has to be replaced *before* constructing: the agent's
     * wrapper closes over whatever `fetch` was when it was built. `call()`
     * drives that wrapper directly, since the mocked SDK client never does.
     */
    const agentRespondingWith = (...responses: Response[]) => {
      const fetchMock = jest.fn();
      for (const response of responses) {
        fetchMock.mockResolvedValueOnce(response);
      }
      global.fetch = fetchMock as unknown as typeof fetch;

      const agent = new CodexAgent(agentConfig());
      const wrapped = (OpenAI as jest.Mock).mock.calls.at(-1)[0].fetch;

      return {
        agent,
        call: () =>
          wrapped("https://chatgpt.com/backend-api/codex/responses", {
            method: "POST",
          }),
      };
    };

    it("has no limits before the first call", () => {
      expect(new CodexAgent(agentConfig()).lastUsageLimits).toBeUndefined();
    });

    it("records the allowance reported on a response", async () => {
      const { agent, call } = agentRespondingWith(
        new Response("{}", { headers: quotaHeaders() })
      );

      await call();

      expect(agent.lastUsageLimits).toMatchObject({
        planType: "plus",
        activeLimit: "premium",
        primary: { usedPercent: 7, windowMinutes: 300 },
        secondary: { usedPercent: 49, windowMinutes: 10080 },
        credits: { balance: 0 },
      });
    });

    it("emits USAGE_LIMITS on every update", async () => {
      const { agent, call } = agentRespondingWith(
        new Response("{}", { headers: quotaHeaders() }),
        new Response("{}", {
          headers: quotaHeaders({ "x-codex-primary-used-percent": "8" }),
        })
      );
      const seen: any[] = [];
      agent.on(AgentEvent.USAGE_LIMITS, (limits: any) => seen.push(limits));

      await call();
      await call();

      expect(seen.map((l) => l.primary.usedPercent)).toEqual([7, 8]);
      expect(agent.lastUsageLimits?.primary?.usedPercent).toBe(8);
    });

    // A 429 is exactly when the remaining allowance matters most, and the
    // headers ride on it — so the error path must not skip the update.
    it("records the allowance from a rejected request too", async () => {
      const { agent, call } = agentRespondingWith(
        new Response(JSON.stringify({ detail: "rate limited" }), {
          status: 429,
          headers: quotaHeaders(),
        })
      );

      await call();

      expect(agent.lastUsageLimits?.primary?.usedPercent).toBe(7);
    });

    it("keeps the last known limits when a response carries none", async () => {
      const { agent, call } = agentRespondingWith(
        new Response("{}", { headers: quotaHeaders() }),
        new Response("{}")
      );

      await call();
      await call();

      expect(agent.lastUsageLimits?.planType).toBe("plus");
    });

    // The wrapper still has to normalise this backend's `{detail: …}` bodies,
    // which the SDK would otherwise drop — quota reading is stacked on top of
    // that, not in place of it.
    it("still rewrites the error body it wraps", async () => {
      const { agent, call } = agentRespondingWith(
        new Response(JSON.stringify({ detail: "Instructions are required" }), {
          status: 400,
          headers: quotaHeaders(),
        })
      );

      const res = await call();

      expect(JSON.parse(await res.text()).error.message).toBe(
        "Instructions are required"
      );
      expect(agent.lastUsageLimits?.planType).toBe("plus");
    });
  });

  describe("cache accounting", () => {
    it("reports the cache split the backend puts on usage", async () => {
      const agent = new CodexAgent(agentConfig());
      mockClient.responses.create.mockReturnValue(
        (async function* () {
          yield {
            type: "response.completed",
            response: {
              id: "resp_1",
              output: [
                {
                  type: "message",
                  status: "completed",
                  role: "assistant",
                  content: [{ type: "output_text", text: "Hi", annotations: [] }],
                },
              ],
              usage: {
                input_tokens: 4055,
                output_tokens: 6,
                total_tokens: 4061,
                // cache_write_tokens is Codex-only — the platform Responses
                // API reports cached_tokens alone.
                input_tokens_details: {
                  cached_tokens: 3840,
                  cache_write_tokens: 12,
                },
                output_tokens_details: { reasoning_tokens: 0 },
              },
            },
          };
        })()
      );

      await agent.execute("hi");

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 4055,
        // Cached tokens are part of input_tokens, not extra on top of them.
        cache_read_tokens: 3840,
        cache_write_tokens: 12,
      });
    });
  });

  it("is an OpenAiAgent, so the shared tool/history machinery applies", () => {
    expect(new CodexAgent(agentConfig())).toBeInstanceOf(OpenAiAgent);
  });
});
