import { describe, expect, it, vi } from "vitest";
import { createLspRuntimeBundle } from "../src/extension/runtime-wiring.js";

type FakeState = {
  manager: FakeManager | null;
  pendingProvider: unknown | null;
};

type FakeManager = {
  name: string;
  resolvePath: (path: string) => string;
};

type FakeFileSync = {
  setSyntheticDotChecker: (checker: (uri: string) => boolean) => void;
  setTreeSitter: (treeSitter: FakeTreeSitter, workspaceIndex: FakeWorkspaceIndex) => void;
  syntheticDotChecker?: (uri: string) => boolean;
  configuredTreeSitter?: FakeTreeSitter;
  configuredWorkspaceIndex?: FakeWorkspaceIndex;
};

type FakeTreeSitter = {
  parse: (path: string) => string;
};

type FakeWorkspaceIndex = {
  findSymbols: (query: string) => string[];
};

function createFakeFileSync(): FakeFileSync {
  return {
    setSyntheticDotChecker: vi.fn(function (this: FakeFileSync, checker: (uri: string) => boolean) {
      this.syntheticDotChecker = checker;
    }),
    setTreeSitter: vi.fn(function (
      this: FakeFileSync,
      treeSitter: FakeTreeSitter,
      workspaceIndex: FakeWorkspaceIndex,
    ) {
      this.configuredTreeSitter = treeSitter;
      this.configuredWorkspaceIndex = workspaceIndex;
    }),
  };
}

describe("createLspRuntimeBundle", () => {
  it("is lazy and does not create the manager until a runtime getter or proxy is used", () => {
    const manager: FakeManager = { name: "lazy-manager", resolvePath: vi.fn((path) => `resolved:${path}`) };
    const createManager = vi.fn(() => manager);

    const bundle = createLspRuntimeBundle<FakeManager, FakeFileSync, FakeTreeSitter, FakeWorkspaceIndex>(
      { manager: null, pendingProvider: null },
      {
        cwd: "/workspace",
        createManager,
        createFileSync: vi.fn(createFakeFileSync),
        createTreeSitter: vi.fn(() => ({ parse: vi.fn((path: string) => `parsed:${path}`) })),
        createWorkspaceIndex: vi.fn(() => ({ findSymbols: vi.fn((query: string) => [`symbol:${query}`]) })),
        isSyntheticDotLocked: vi.fn(() => false),
      },
    );

    expect(createManager).not.toHaveBeenCalled();

    expect(bundle.getManager()).toBe(manager);
    expect(createManager).toHaveBeenCalledOnce();

    expect(bundle.managerProxy.resolvePath("src/index.ts")).toBe("resolved:src/index.ts");
    expect(createManager).toHaveBeenCalledOnce();
  });

  it("passes pendingProvider from state when creating the manager", () => {
    const pendingProvider = { workspaceRoot: "/workspace" };
    const state: FakeState = { manager: null, pendingProvider };
    const manager: FakeManager = { name: "manager", resolvePath: vi.fn((path) => path) };
    const createManager = vi.fn(() => manager);

    const bundle = createLspRuntimeBundle<FakeManager, FakeFileSync, FakeTreeSitter, FakeWorkspaceIndex>(state, {
      cwd: "/workspace",
      createManager,
      createFileSync: vi.fn(createFakeFileSync),
      createTreeSitter: vi.fn(() => ({ parse: vi.fn() })),
      createWorkspaceIndex: vi.fn(() => ({ findSymbols: vi.fn() })),
      isSyntheticDotLocked: vi.fn(() => false),
    });

    expect(bundle.getManager()).toBe(manager);
    expect(createManager).toHaveBeenCalledWith("/workspace", pendingProvider);
  });

  it("configures file sync with synthetic dot checker, tree-sitter, and workspace index when created", () => {
    const fileSync = createFakeFileSync();
    const treeSitter: FakeTreeSitter = { parse: vi.fn((path) => `parsed:${path}`) };
    const workspaceIndex: FakeWorkspaceIndex = { findSymbols: vi.fn((query) => [`symbol:${query}`]) };
    const isSyntheticDotLocked = vi.fn((uri: string) => uri === "file:///locked.ts");

    const bundle = createLspRuntimeBundle<FakeManager, FakeFileSync, FakeTreeSitter, FakeWorkspaceIndex>(
      { manager: null, pendingProvider: null },
      {
        cwd: "/workspace",
        createManager: vi.fn(() => ({ name: "manager", resolvePath: vi.fn((path: string) => path) })),
        createFileSync: vi.fn(() => fileSync),
        createTreeSitter: vi.fn(() => treeSitter),
        createWorkspaceIndex: vi.fn(() => workspaceIndex),
        isSyntheticDotLocked,
      },
    );

    expect(bundle.getFileSync()).toBe(fileSync);
    expect(fileSync.setSyntheticDotChecker).toHaveBeenCalledOnce();
    expect(fileSync.syntheticDotChecker?.("file:///locked.ts")).toBe(true);
    expect(fileSync.syntheticDotChecker?.("file:///open.ts")).toBe(false);
    expect(isSyntheticDotLocked).toHaveBeenCalledWith("file:///locked.ts");
    expect(fileSync.setTreeSitter).toHaveBeenCalledWith(treeSitter, workspaceIndex);
  });

  it("exposes runtime accessors and proxies that resolve through the current runtime resources", () => {
    const state: FakeState = { manager: null, pendingProvider: null };
    const firstManager: FakeManager = { name: "first", resolvePath: vi.fn((path) => `first:${path}`) };
    const secondManager: FakeManager = { name: "second", resolvePath: vi.fn((path) => `second:${path}`) };

    const bundle = createLspRuntimeBundle<FakeManager, FakeFileSync, FakeTreeSitter, FakeWorkspaceIndex>(state, {
      cwd: "/workspace",
      createManager: vi.fn(() => firstManager),
      createFileSync: vi.fn(createFakeFileSync),
      createTreeSitter: vi.fn(() => ({ parse: vi.fn((path: string) => `parsed:${path}`) })),
      createWorkspaceIndex: vi.fn(() => ({ findSymbols: vi.fn((query: string) => [`symbol:${query}`]) })),
      isSyntheticDotLocked: vi.fn(() => false),
    });

    expect(bundle.getManagerOrNull()).toBeNull();
    expect(bundle.managerProxy.name).toBe("first");
    expect(bundle.managerProxy.resolvePath("a.ts")).toBe("first:a.ts");

    state.manager = secondManager;

    expect(bundle.runtime.getManager()).toBe(secondManager);
    expect(bundle.managerProxy.name).toBe("second");
    expect(bundle.managerProxy.resolvePath("b.ts")).toBe("second:b.ts");
  });
});
