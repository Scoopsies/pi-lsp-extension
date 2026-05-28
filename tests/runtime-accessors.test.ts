import { describe, expect, it, vi } from "vitest";
import { createRuntimeAccessors } from "../src/extension/runtime-accessors.js";

type FakeManager = {
  name: string;
  resolvePath: (path: string) => string;
};

type FakeTreeSitter = {
  activeLanguage: string;
  parse: (path: string) => string;
};

type FakeWorkspaceIndex = {
  root: string;
  findSymbols: (query: string) => string[];
};

function createFakeRuntime() {
  let currentManager: FakeManager = {
    name: "first-manager",
    resolvePath: vi.fn((path: string) => `first:${path}`),
  };
  let currentTreeSitter: FakeTreeSitter = {
    activeLanguage: "typescript",
    parse: vi.fn((path: string) => `first-tree:${path}`),
  };
  let currentWorkspaceIndex: FakeWorkspaceIndex = {
    root: "/first",
    findSymbols: vi.fn((query: string) => [`first-index:${query}`]),
  };
  const currentFileSync = { read: vi.fn() };

  const runtime = {
    getManager: vi.fn(() => currentManager),
    getFileSync: vi.fn(() => currentFileSync),
    getTreeSitter: vi.fn(() => currentTreeSitter),
    getWorkspaceIndex: vi.fn(() => currentWorkspaceIndex),
  };

  return {
    runtime,
    currentFileSync,
    swapManager(manager: FakeManager) {
      currentManager = manager;
    },
    swapTreeSitter(treeSitter: FakeTreeSitter) {
      currentTreeSitter = treeSitter;
    },
    swapWorkspaceIndex(workspaceIndex: FakeWorkspaceIndex) {
      currentWorkspaceIndex = workspaceIndex;
    },
  };
}

describe("createRuntimeAccessors", () => {
  it("managerProxy delegates property and method access to the current runtime manager", () => {
    const { runtime, swapManager } = createFakeRuntime();
    const { managerProxy } = createRuntimeAccessors(runtime, () => null);

    expect(managerProxy.name).toBe("first-manager");
    expect(managerProxy.resolvePath(".")).toBe("first:.");

    const nextManager: FakeManager = {
      name: "second-manager",
      resolvePath: vi.fn((path: string) => `second:${path}`),
    };
    swapManager(nextManager);

    expect(managerProxy.name).toBe("second-manager");
    expect(managerProxy.resolvePath(".")).toBe("second:.");
    expect(nextManager.resolvePath).toHaveBeenCalledWith(".");
    expect(runtime.getManager).toHaveBeenCalledTimes(4);
  });

  it("treeSitterProxy and workspaceIndexProxy delegate to current runtime resources", () => {
    const { runtime, swapTreeSitter, swapWorkspaceIndex } = createFakeRuntime();
    const { treeSitterProxy, workspaceIndexProxy } = createRuntimeAccessors(runtime, () => null);

    expect(treeSitterProxy.activeLanguage).toBe("typescript");
    expect(treeSitterProxy.parse("src/index.ts")).toBe("first-tree:src/index.ts");
    expect(workspaceIndexProxy.root).toBe("/first");
    expect(workspaceIndexProxy.findSymbols("create")).toEqual(["first-index:create"]);

    const nextTreeSitter: FakeTreeSitter = {
      activeLanguage: "tsx",
      parse: vi.fn((path: string) => `second-tree:${path}`),
    };
    const nextWorkspaceIndex: FakeWorkspaceIndex = {
      root: "/second",
      findSymbols: vi.fn((query: string) => [`second-index:${query}`]),
    };
    swapTreeSitter(nextTreeSitter);
    swapWorkspaceIndex(nextWorkspaceIndex);

    expect(treeSitterProxy.activeLanguage).toBe("tsx");
    expect(treeSitterProxy.parse("src/index.ts")).toBe("second-tree:src/index.ts");
    expect(workspaceIndexProxy.root).toBe("/second");
    expect(workspaceIndexProxy.findSymbols("create")).toEqual(["second-index:create"]);
  });

  it("getFileSync delegates to runtime.getFileSync", () => {
    const { runtime, currentFileSync } = createFakeRuntime();
    const { getFileSync } = createRuntimeAccessors(runtime, () => null);

    expect(getFileSync()).toBe(currentFileSync);
    expect(runtime.getFileSync).toHaveBeenCalledOnce();
  });

  it("getManagerOrNull returns the supplied nullable manager getter without forcing runtime.getManager", () => {
    const { runtime } = createFakeRuntime();
    const nullableManager = { name: "nullable-manager" };
    const suppliedGetManagerOrNull = vi.fn(() => nullableManager);
    const { getManagerOrNull } = createRuntimeAccessors(runtime, suppliedGetManagerOrNull);

    expect(getManagerOrNull()).toBe(nullableManager);
    expect(suppliedGetManagerOrNull).toHaveBeenCalledOnce();
    expect(runtime.getManager).not.toHaveBeenCalled();
  });
});
