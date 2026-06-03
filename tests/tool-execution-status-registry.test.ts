import { describe, expect, it } from "vitest";

import { registerToolExecutionStatusUpdater } from "../src/status/tool-execution-status-registry.js";

type ToolExecutionEndHandler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
type StatusUpdate = { color: string; text: string };
type FakeServerStatus = {
  languageId: string;
  running: boolean;
  diagnosticsCount: number;
  errorsCount?: number;
  warningsCount?: number;
  infoCount?: number;
  hintsCount?: number;
};

class FakePi {
  toolExecutionEndHandler: ToolExecutionEndHandler | undefined;

  on(eventName: string, handler: ToolExecutionEndHandler): void {
    if (eventName === "tool_execution_end") {
      this.toolExecutionEndHandler = handler;
    }
  }
}

class FakeLspManager {
  constructor(private readonly statuses: FakeServerStatus[]) {}

  getStatus(): FakeServerStatus[] {
    return this.statuses;
  }
}

const runningStatus = (languageId: string, diagnosticsCount = 0, counts: Partial<FakeServerStatus> = {}): FakeServerStatus => ({
  languageId,
  running: true,
  diagnosticsCount,
  ...counts,
});

const stoppedStatus = (languageId: string, diagnosticsCount = 0): FakeServerStatus => ({
  languageId,
  running: false,
  diagnosticsCount,
});

const captureToolExecutionEndHandler = (manager: FakeLspManager | null) => {
  const pi = new FakePi();
  const statusUpdates: StatusUpdate[] = [];

  registerToolExecutionStatusUpdater(
    pi as never,
    () => manager as never,
    (color: string, text: string) => statusUpdates.push({ color, text }),
  );

  if (!pi.toolExecutionEndHandler) throw new Error("tool_execution_end handler was not registered");
  return { handler: pi.toolExecutionEndHandler, statusUpdates };
};

describe("tool execution status registry", () => {
  it("registers a tool_execution_end handler", () => {
    const pi = new FakePi();

    registerToolExecutionStatusUpdater(pi as never, () => null, () => undefined);

    expect(pi.toolExecutionEndHandler).toBeDefined();
  });

  it("sets accent idle status when no manager is available", async () => {
    const { handler, statusUpdates } = captureToolExecutionEndHandler(null);

    await handler({}, {});

    expect(statusUpdates).toEqual([{ color: "accent", text: "LSP: idle" }]);
  });

  it("sets accent running status for running language servers only", async () => {
    const manager = new FakeLspManager([
      runningStatus("typescript"),
      stoppedStatus("python"),
      runningStatus("rust"),
    ]);
    const { handler, statusUpdates } = captureToolExecutionEndHandler(manager);

    await handler({}, {});

    expect(statusUpdates).toEqual([{ color: "accent", text: "LSP: running (typescript, rust)" }]);
  });

  it("appends aggregated error diagnostics with singular and plural wording", async () => {
    const oneError = captureToolExecutionEndHandler(new FakeLspManager([runningStatus("typescript", 1)]));
    const twoErrors = captureToolExecutionEndHandler(new FakeLspManager([
      runningStatus("typescript", 1),
      runningStatus("rust", 1),
    ]));

    await oneError.handler({}, {});
    await twoErrors.handler({}, {});

    expect(oneError.statusUpdates).toEqual([
      { color: "accent", text: "LSP: running (typescript) • 1 error" },
    ]);
    expect(twoErrors.statusUpdates).toEqual([
      { color: "accent", text: "LSP: running (typescript, rust) • 2 errors" },
    ]);
  });

  it("separates errors, warnings, info, and hints when severity counts are available", async () => {
    const manager = new FakeLspManager([
      runningStatus("javascript", 44, { hintsCount: 44, errorsCount: 0, warningsCount: 0, infoCount: 0 }),
      runningStatus("rust", 3, { errorsCount: 1, warningsCount: 2, hintsCount: 0, infoCount: 0 }),
    ]);
    const { handler, statusUpdates } = captureToolExecutionEndHandler(manager);

    await handler({}, {});

    expect(statusUpdates).toEqual([
      { color: "accent", text: "LSP: running (javascript, rust) • 1 error • 2 warnings • 44 hints" },
    ]);
  });
});
