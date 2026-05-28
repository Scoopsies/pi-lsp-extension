import { describe, expect, it, vi } from "vitest";

vi.mock("../src/tools/code-overview.js", () => ({
  createCodeOverviewTool: (getRootDir: () => string) => ({
    name: "code_overview",
    async execute() {
      return getRootDir();
    },
  }),
}));

vi.mock("../src/tools/code-search.js", () => ({
  createCodeSearchTool: (getRootDir: () => string) => ({
    name: "ast_search",
    async execute() {
      return getRootDir();
    },
  }),
}));

vi.mock("../src/tools/code-rewrite.js", () => ({
  createCodeRewriteTool: (getRootDir: () => string) => ({
    name: "code_rewrite",
    async execute() {
      return getRootDir();
    },
  }),
}));

const importRegistry = async () => import("../src/tools/registry.js");

describe("registerTools root resolution", () => {
  it("resolves structural tool roots from the current manager at invocation time", async () => {
    const { registerTools } = await importRegistry();
    const registeredTools = new Map<string, { execute: () => Promise<string> }>();
    const fakePi = {
      registerTool(tool: { name: string; execute: () => Promise<string> }) {
        registeredTools.set(tool.name, tool);
      },
    };
    let currentManager: { resolvePath(path: string): string } | null = null;

    registerTools(
      fakePi as any,
      {} as any,
      {} as any,
      {} as any,
      () => ({}) as any,
      () => currentManager as any,
    );
    currentManager = {
      resolvePath: vi.fn(() => "/workspace/project"),
    };

    await expect(registeredTools.get("code_overview")!.execute()).resolves.toBe("/workspace/project");
    expect(currentManager.resolvePath).toHaveBeenCalledWith(".");
  });
});
