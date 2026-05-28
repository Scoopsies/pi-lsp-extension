import { describe, expect, it, vi } from "vitest";

const loadLifecycle = async () => {
  const module = await import("../src/extension/session-lifecycle.js");
  return module.registerExtensionLifecycle;
};

type SessionHandler = (event?: unknown, ctx?: FakeContext) => void | Promise<void>;

type FakeContext = {
  cwd: string;
};

const createFakePi = () => {
  const handlers = new Map<string, SessionHandler>();

  return {
    handlers,
    pi: {
      on(eventName: string, handler: SessionHandler) {
        handlers.set(eventName, handler);
      },
    },
  };
};

const createFakeState = () => ({
  latestCtx: null as FakeContext | null,
  lspStatusCalls: [] as Array<{ color: string; text: string }>,
  setLspStatus(color: string, text: string) {
    this.lspStatusCalls.push({ color, text });
  },
});

const createFakeRuntime = () => ({
  recreate: vi.fn(async (_cwd: string) => undefined),
  shutdown: vi.fn(async () => undefined),
  manager: {
    getStatus: vi.fn(() => ({ workspaceProviderStatus: "workspace ready" })),
  },
  treeSitter: {
    init: vi.fn(async () => undefined),
  },
});

describe("extension session lifecycle registration", () => {
  it("registers session_start and session_shutdown handlers", async () => {
    const registerExtensionLifecycle = await loadLifecycle();
    const { pi, handlers } = createFakePi();

    registerExtensionLifecycle(pi, createFakeState(), createFakeRuntime(), {
      configRef: { current: null },
      readProjectConfig: vi.fn(),
      applyProjectConfig: vi.fn(),
    });

    expect(handlers.has("session_start")).toBe(true);
    expect(handlers.has("session_shutdown")).toBe(true);
  });

  it("session_start recreates runtime, initializes tree-sitter, sets status, reads and applies project config", async () => {
    const registerExtensionLifecycle = await loadLifecycle();
    const { pi, handlers } = createFakePi();
    const state = createFakeState();
    const runtime = createFakeRuntime();
    const projectConfig = { diagnostics: { enabled: true } };
    const configRef = { current: null as unknown };
    const readProjectConfig = vi.fn(() => projectConfig);
    const applyProjectConfig = vi.fn();
    const ctx = { cwd: "/project" };

    registerExtensionLifecycle(pi, state, runtime, {
      configRef,
      readProjectConfig,
      applyProjectConfig,
    });

    await handlers.get("session_start")?.({}, ctx);

    expect(state.latestCtx).toBe(ctx);
    expect(runtime.recreate).toHaveBeenCalledWith("/project");
    expect(runtime.treeSitter.init).toHaveBeenCalledOnce();
    expect(state.lspStatusCalls.at(-1)?.text).toContain("workspace ready");
    expect(readProjectConfig).toHaveBeenCalledWith("/project");
    expect(configRef.current).toBe(projectConfig);
    expect(applyProjectConfig).toHaveBeenCalledWith(projectConfig, runtime.manager, state.setLspStatus);
  });

  it("session_shutdown clears latestCtx and awaits runtime shutdown", async () => {
    const registerExtensionLifecycle = await loadLifecycle();
    const { pi, handlers } = createFakePi();
    const state = createFakeState();
    state.latestCtx = { cwd: "/project" };

    let finishShutdown!: () => void;
    const shutdownFinished = new Promise<void>((resolve) => {
      finishShutdown = resolve;
    });
    const runtime = {
      ...createFakeRuntime(),
      shutdown: vi.fn(() => shutdownFinished),
    };

    registerExtensionLifecycle(pi, state, runtime, {
      configRef: { current: null },
      readProjectConfig: vi.fn(),
      applyProjectConfig: vi.fn(),
    });

    let handlerFinished = false;
    const handlerPromise = Promise.resolve(handlers.get("session_shutdown")?.()).then(() => {
      handlerFinished = true;
    });

    await Promise.resolve();

    expect(state.latestCtx).toBeNull();
    expect(runtime.shutdown).toHaveBeenCalledOnce();
    expect(handlerFinished).toBe(false);

    finishShutdown();
    await handlerPromise;

    expect(handlerFinished).toBe(true);
  });
});
