import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticSeverity, type Diagnostic } from "vscode-languageserver-protocol";
import { registerAutoDiagnostics } from "../src/diagnostics/auto-diagnostics-registry.js";

type ToolResultHandler = (event: unknown) => Promise<unknown> | unknown;

type ProjectConfig = {
  autoInjectDiagnostics?: boolean | string[];
};

class FakePi {
  toolResultHandler: ToolResultHandler | undefined;

  on(eventName: string, handler: ToolResultHandler): void {
    if (eventName === "tool_result") {
      this.toolResultHandler = handler;
    }
  }
}

class FakeDiagnosticClient {
  constructor(private readonly diagnostics: Diagnostic[]) {}

  getDiagnostics(_uri: string): Diagnostic[] {
    return this.diagnostics;
  }
}

class FakeLspManager {
  readonly client = new FakeDiagnosticClient([
    {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: 4, character: 12 },
        end: { line: 4, character: 18 },
      },
      message: "Cannot find name 'missingValue'.",
      source: "tsserver",
    },
  ]);

  getLanguageId(path: string): string | null {
    return path.endsWith(".ts") ? "typescript" : null;
  }

  getRunningClient(_languageId: string): FakeDiagnosticClient {
    return this.client;
  }

  getFileUri(path: string): string {
    return `file:///workspace/${path}`;
  }

  resolvePath(path: string): string {
    return path === "." ? "/workspace" : `/workspace/${path}`;
  }
}

const writeResult = (overrides: Record<string, unknown> = {}) => ({
  toolName: "write",
  isError: false,
  input: { path: "src/example.ts" },
  content: [{ type: "text", text: "Wrote src/example.ts" }],
  ...overrides,
});

const registerHandler = (projectConfig: ProjectConfig | null = null): ToolResultHandler => {
  const pi = new FakePi();
  const manager = new FakeLspManager();

  registerAutoDiagnostics(pi as never, {
    getManager: () => manager as never,
    getProjectConfig: () => projectConfig,
  });

  if (!pi.toolResultHandler) throw new Error("tool_result handler was not registered");
  return pi.toolResultHandler;
};

const resolveAfterDiagnosticsSettle = async (handler: ToolResultHandler, event: unknown): Promise<unknown> => {
  const resultPromise = Promise.resolve(handler(event));
  await vi.runOnlyPendingTimersAsync();
  return resultPromise;
};

describe("auto diagnostics registration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers a tool_result handler that appends diagnostics summary for successful write results", async () => {
    const handler = registerHandler();

    const result = await resolveAfterDiagnosticsSettle(handler, writeResult());

    expect(result).toEqual({
      content: [
        { type: "text", text: "Wrote src/example.ts" },
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("src/example.ts:5:13 error: Cannot find name 'missingValue'. [tsserver]"),
        }),
      ],
    });
    expect(JSON.stringify(result)).toContain("⚠ LSP: 1 error(s) in src/example.ts");
  });

  it("does nothing for successful read results or errored write results", async () => {
    const handler = registerHandler();

    await expect(resolveAfterDiagnosticsSettle(handler, writeResult({ toolName: "read" }))).resolves.toBeUndefined();
    await expect(resolveAfterDiagnosticsSettle(handler, writeResult({ isError: true }))).resolves.toBeUndefined();
  });

  it("does nothing when autoInjectDiagnostics is false", async () => {
    const handler = registerHandler({ autoInjectDiagnostics: false });

    await expect(resolveAfterDiagnosticsSettle(handler, writeResult())).resolves.toBeUndefined();
  });
});
