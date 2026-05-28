import { describe, expect, it, vi } from "vitest";
import { registerCommands } from "../src/commands/registry.js";

describe("lsp command manager lookup", () => {
  it("uses the manager returned by the getter when invoked after registration", async () => {
    const registeredCommands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();
    const fakePi = {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        registeredCommands.set(name, command);
      },
    };

    const getStatus = vi.fn(() => [
      {
        languageId: "typescript",
        command: "typescript-language-server",
        running: true,
        diagnosticsCount: 2,
        shared: false,
      },
    ]);
    const getAllDiagnostics = vi.fn(() => new Map([["src/index.ts", [{ message: "example diagnostic" }]]]));
    const manager = { getStatus, getAllDiagnostics };
    const getManager = vi.fn(() => manager);
    const notifications: Array<{ message: string; level: string }> = [];
    const ctx = {
      ui: {
        notify(message: string, level: string) {
          notifications.push({ message, level });
        },
      },
    };

    registerCommands(fakePi as any, null, getManager as any);

    const lspCommand = registeredCommands.get("lsp");
    expect(lspCommand).toBeDefined();

    await lspCommand!.handler("", ctx);

    expect(notifications).not.toContainEqual({
      message: "LSP manager not initialized",
      level: "warning",
    });
    expect(getManager).toHaveBeenCalledOnce();
    expect(getStatus).toHaveBeenCalledOnce();
    expect(getAllDiagnostics).toHaveBeenCalledOnce();
    expect(notifications).toContainEqual({
      message: "🟢 typescript: typescript-language-server (2 diagnostics)",
      level: "info",
    });
  });
});
