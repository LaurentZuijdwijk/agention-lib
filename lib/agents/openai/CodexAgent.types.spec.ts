import { CodexAgent, CodexAgentConfig } from "./CodexAgent";
import { History } from "../../history/History";

jest.mock("openai");
// `fromCodexCli` would otherwise read the real ~/.codex/auth.json, which is not
// there on CI.
jest.mock("./codex-auth", () => ({
  ...jest.requireActual("./codex-auth"),
  loadCodexCredentials: jest
    .fn()
    .mockResolvedValue({ accessToken: "at", refreshToken: "rt" }),
}));

/**
 * Compile-time assertions for the factory return types.
 *
 * `CodexAgent.spec.ts` carries `@ts-nocheck`, so the polymorphic `this` typing
 * has to be proven here: this file is type-checked by ts-jest, which fails the
 * suite on any error. The runtime half — that a subclass is what actually gets
 * constructed — is covered by the "subclassing" tests over there.
 */
class Tagged extends CodexAgent {
  readonly tag = "tagged";
}

/** The shape people actually write: an extra config field and an override. */
class Extended extends CodexAgent {
  readonly extra?: string;

  constructor(config: CodexAgentConfig & { extra?: string }, history?: History) {
    super(config, history);
    this.extra = config.extra;
  }

  protected override defaultIncludeEncryptedReasoning(): boolean {
    return false;
  }
}

const config = { id: "1", name: "A", description: "d" };
const credentials = { accessToken: "at", refreshToken: "rt" };

describe("CodexAgent factory types", () => {
  it("hands back the subclass, not the base class", async () => {
    // Each annotation is the assertion: a factory pinned to `CodexAgent` — as
    // hard-coding `new CodexAgent(…)` used to do — fails to compile here.
    const tagged: Tagged = Tagged.fromCredentials(credentials, config);
    const extended: Extended = await Extended.fromCodexCli(config);
    const base: CodexAgent = await CodexAgent.fromCodexCli(config);

    expect([tagged, extended, base].every((a) => a instanceof CodexAgent)).toBe(
      true
    );
  });
});
