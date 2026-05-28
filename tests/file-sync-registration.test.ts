import { describe, expect, it, vi } from "vitest";

class FakeFileSync {
  static instances: FakeFileSync[] = [];

  readonly fileReadPaths: string[] = [];

  constructor(_manager: unknown) {
    FakeFileSync.instances.push(this);
  }

  setSyntheticDotChecker(_checker: unknown): void {}

  setTreeSitter(_treeSitter: unknown, _workspaceIndex: unknown): void {}

  async handleFileRead(path: string): Promise<void> {
    this.fileReadPaths.push(path);
  }
}

class FakeLspManager {}

class FakeTreeSitterManager {}

class FakeWorkspaceIndex {
  constructor(_cwd: string, _treeSitter: unknown) {}
}

const captureToolResultHandler = async () => {
  vi.resetModules();
  FakeFileSync.instances = [];

  vi.doMock("../src/file-sync/file-sync.js", () => ({ FileSync: FakeFileSync }));
  vi.doMock("../src/lsp-manager.js", () => ({ LspManager: FakeLspManager }));
  vi.doMock("../src/tree-sitter/parser-manager.js", () => ({ TreeSitterManager: FakeTreeSitterManager }));
  vi.doMock("../src/tree-sitter/workspace-index.js", () => ({ WorkspaceIndex: FakeWorkspaceIndex }));

  const indexModule = await import("../src/index.js");
  const { default: lspExtension } = indexModule;
  let toolResultHandler: ((event: unknown) => Promise<unknown>) | undefined;

  const fakePi = {
    events: {
      on(_eventName: string, _handler: unknown) {},
    },
    on(eventName: string, handler: unknown) {
      if (eventName === "tool_result") {
        toolResultHandler = handler as (event: unknown) => Promise<unknown>;
      }
    },
    registerTool(_tool: unknown) {},
    registerCommand(_name: string, _command: unknown) {},
  };

  lspExtension(fakePi as any);

  if (!toolResultHandler) throw new Error("tool_result handler was not registered");
  return toolResultHandler;
};

describe("file sync registration", () => {
  it("handles successful read tool results by syncing the read path without overriding the tool result", async () => {
    const toolResultHandler = await captureToolResultHandler();

    const result = await toolResultHandler({
      toolName: "read",
      isError: false,
      input: { path: "src/index.ts" },
      content: [{ type: "text", text: "file contents" }],
    });

    expect(FakeFileSync.instances).toHaveLength(1);
    expect(FakeFileSync.instances[0].fileReadPaths).toEqual(["src/index.ts"]);
    expect(result).toBeUndefined();
  });
});
