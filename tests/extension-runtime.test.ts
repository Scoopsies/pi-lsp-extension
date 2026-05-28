import { describe, expect, it, vi } from "vitest";
import { createExtensionRuntime } from "../src/extension/runtime.js";

type FakeState = {
  manager: unknown | null;
  pendingProvider: unknown | null;
};

const createFakeState = (): FakeState => ({
  manager: null,
  pendingProvider: null,
});

describe("extension runtime", () => {
  it("creates runtime resources once and returns the same instances from lazy getters", () => {
    const manager = { id: "manager" };
    const fileSync = { id: "fileSync" };
    const treeSitter = { id: "treeSitter" };
    const workspaceIndex = { id: "workspaceIndex" };

    const createManager = vi.fn(() => manager);
    const createFileSync = vi.fn(() => fileSync);
    const createTreeSitter = vi.fn(() => treeSitter);
    const createWorkspaceIndex = vi.fn(() => workspaceIndex);

    const runtime = createExtensionRuntime({
      cwd: "/workspace",
      state: createFakeState(),
      createManager,
      createFileSync,
      createTreeSitter,
      createWorkspaceIndex,
    });

    expect(runtime.getManager()).toBe(manager);
    expect(runtime.getManager()).toBe(manager);
    expect(runtime.getFileSync()).toBe(fileSync);
    expect(runtime.getFileSync()).toBe(fileSync);
    expect(runtime.getTreeSitter()).toBe(treeSitter);
    expect(runtime.getTreeSitter()).toBe(treeSitter);
    expect(runtime.getWorkspaceIndex()).toBe(workspaceIndex);
    expect(runtime.getWorkspaceIndex()).toBe(workspaceIndex);

    expect(createManager).toHaveBeenCalledOnce();
    expect(createFileSync).toHaveBeenCalledOnce();
    expect(createTreeSitter).toHaveBeenCalledOnce();
    expect(createWorkspaceIndex).toHaveBeenCalledOnce();
  });

  it("shuts down manager and tree-sitter, clears instances, and creates fresh instances afterward", async () => {
    const firstManager = { shutdownAll: vi.fn(async () => undefined) };
    const secondManager = { shutdownAll: vi.fn(async () => undefined) };
    const firstFileSync = { id: "firstFileSync" };
    const secondFileSync = { id: "secondFileSync" };
    const firstTreeSitter = { shutdown: vi.fn() };
    const secondTreeSitter = { shutdown: vi.fn() };
    const firstWorkspaceIndex = { id: "firstWorkspaceIndex" };
    const secondWorkspaceIndex = { id: "secondWorkspaceIndex" };

    const createManager = vi.fn()
      .mockReturnValueOnce(firstManager)
      .mockReturnValueOnce(secondManager);
    const createFileSync = vi.fn()
      .mockReturnValueOnce(firstFileSync)
      .mockReturnValueOnce(secondFileSync);
    const createTreeSitter = vi.fn()
      .mockReturnValueOnce(firstTreeSitter)
      .mockReturnValueOnce(secondTreeSitter);
    const createWorkspaceIndex = vi.fn()
      .mockReturnValueOnce(firstWorkspaceIndex)
      .mockReturnValueOnce(secondWorkspaceIndex);

    const runtime = createExtensionRuntime({
      cwd: "/workspace",
      state: createFakeState(),
      createManager,
      createFileSync,
      createTreeSitter,
      createWorkspaceIndex,
    });

    expect(runtime.getManager()).toBe(firstManager);
    expect(runtime.getFileSync()).toBe(firstFileSync);
    expect(runtime.getTreeSitter()).toBe(firstTreeSitter);
    expect(runtime.getWorkspaceIndex()).toBe(firstWorkspaceIndex);

    await runtime.shutdown();

    expect(firstManager.shutdownAll).toHaveBeenCalledOnce();
    expect(firstTreeSitter.shutdown).toHaveBeenCalledOnce();
    expect(firstManager.shutdownAll.mock.invocationCallOrder[0])
      .toBeLessThan(firstTreeSitter.shutdown.mock.invocationCallOrder[0]);

    expect(runtime.getManager()).toBe(secondManager);
    expect(runtime.getFileSync()).toBe(secondFileSync);
    expect(runtime.getTreeSitter()).toBe(secondTreeSitter);
    expect(runtime.getWorkspaceIndex()).toBe(secondWorkspaceIndex);

    expect(createManager).toHaveBeenCalledTimes(2);
    expect(createFileSync).toHaveBeenCalledTimes(2);
    expect(createTreeSitter).toHaveBeenCalledTimes(2);
    expect(createWorkspaceIndex).toHaveBeenCalledTimes(2);
  });
});
