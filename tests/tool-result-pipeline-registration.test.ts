import { describe, expect, it } from "vitest";
import { DiagnosticSeverity, type Diagnostic } from "vscode-languageserver-protocol";
import { registerToolResultPipeline } from "../src/tool-results/registry.js";

type ToolResultHandler = (event: any) => Promise<unknown> | unknown;

class FakePi {
  readonly toolResultHandlers: ToolResultHandler[] = [];

  on(eventName: string, handler: ToolResultHandler): void {
    if (eventName === "tool_result") {
      this.toolResultHandlers.push(handler);
    }
  }
}

class FakeFileSync {
  constructor(
    private readonly log: string[],
    private readonly throwOnWrite = false,
  ) {}

  async handleFileRead(path: string): Promise<void> {
    this.log.push(`sync:read:${path}`);
  }

  async handleFileWrite(path: string): Promise<void> {
    this.log.push(`sync:write:${path}`);
    if (this.throwOnWrite) throw new Error("sync failed");
  }
}

class FakeDiagnosticClient {
  constructor(private readonly log: string[]) {}

  getDiagnostics(_uri: string): Diagnostic[] {
    this.log.push("diagnostics:getDiagnostics");
    return [
      {
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        message: "Expected diagnostic",
      },
    ];
  }
}

class FakeLspManager {
  readonly client: FakeDiagnosticClient;

  constructor(private readonly log: string[]) {
    this.client = new FakeDiagnosticClient(log);
  }

  getLanguageId(path: string): string | null {
    this.log.push(`diagnostics:language:${path}`);
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

const writeResult = () => ({
  toolName: "write",
  isError: false,
  input: { path: "src/example.ts" },
  content: [{ type: "text", text: "Wrote src/example.ts" }],
});

const registerHandler = (options: { throwOnGetFileSync?: boolean; throwOnWrite?: boolean; getFileSyncCalls?: { count: number } } = {}) => {
  const log: string[] = [];
  const pi = new FakePi();
  const manager = new FakeLspManager(log);
  const getFileSyncCalls = options.getFileSyncCalls ?? { count: 0 };

  registerToolResultPipeline(pi as never, {
    getFileSync: () => {
      getFileSyncCalls.count += 1;
      log.push("sync:getFileSync");
      if (options.throwOnGetFileSync) throw new Error("sync unavailable");
      return new FakeFileSync(log, options.throwOnWrite) as never;
    },
    getManager: () => manager as never,
    getProjectConfig: () => null,
    waitForDiagnosticsToSettle: async () => {
      log.push("diagnostics:settle");
    },
  });

  if (pi.toolResultHandlers.length !== 1) throw new Error("expected exactly one tool_result handler");
  return { handler: pi.toolResultHandlers[0], log };
};

describe("tool result pipeline registration", () => {
  it("registers one tool_result handler", () => {
    const pi = new FakePi();

    registerToolResultPipeline(pi as never, {
      getFileSync: () => new FakeFileSync([]) as never,
      getManager: () => null,
      getProjectConfig: () => null,
      waitForDiagnosticsToSettle: async () => {},
    });

    expect(pi.toolResultHandlers).toHaveLength(1);
  });

  it("runs file sync before auto diagnostics", async () => {
    const { handler, log } = registerHandler();

    const result = await handler(writeResult());

    expect(log).toEqual([
      "sync:getFileSync",
      "sync:write:src/example.ts",
      "diagnostics:language:src/example.ts",
      "diagnostics:settle",
      "diagnostics:getDiagnostics",
    ]);
    expect(result).toEqual({
      content: [
        { type: "text", text: "Wrote src/example.ts" },
        expect.objectContaining({ text: expect.stringContaining("Expected diagnostic") }),
      ],
    });
  });

  it("still runs diagnostics when file sync catches an error", async () => {
    const { handler, log } = registerHandler({ throwOnWrite: true });

    const result = await handler(writeResult());

    expect(log).toContain("sync:write:src/example.ts");
    expect(log).toContain("diagnostics:getDiagnostics");
    expect(JSON.stringify(result)).toContain("Expected diagnostic");
  });

  it("still runs diagnostics when getFileSync throws", async () => {
    const { handler, log } = registerHandler({ throwOnGetFileSync: true });

    const result = await handler(writeResult());

    expect(log).toEqual([
      "sync:getFileSync",
      "diagnostics:language:src/example.ts",
      "diagnostics:settle",
      "diagnostics:getDiagnostics",
    ]);
    expect(JSON.stringify(result)).toContain("Expected diagnostic");
  });

  it("preserves eager getFileSync calls for unrelated tool results", async () => {
    const getFileSyncCalls = { count: 0 };
    const { handler } = registerHandler({ getFileSyncCalls });

    await handler({
      toolName: "lsp_hover",
      isError: false,
      input: { path: "src/example.ts" },
      content: [{ type: "text", text: "hover" }],
    });

    expect(getFileSyncCalls.count).toBe(1);
  });
});
