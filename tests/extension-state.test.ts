import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { createExtensionState } from "../src/extension/state.js";

type FakeExtensionContext = {
  ui: {
    setStatus: ExtensionContext["ui"]["setStatus"];
    theme: Pick<ExtensionContext["ui"]["theme"], "fg">;
  };
};

type MakeCtxOptions = {
  setStatus?: ExtensionContext["ui"]["setStatus"];
};

const makeCtx = ({
  setStatus = vi.fn((_key: string, _text: string | undefined) => {}),
}: MakeCtxOptions = {}): ExtensionContext => {
  const fakeCtx = {
    ui: {
      setStatus,
      theme: {
        fg: (color, text) => `themed:${color}:${text}`,
      },
    },
  } satisfies FakeExtensionContext;

  return fakeCtx as unknown as ExtensionContext;
};

describe("ExtensionState", () => {
  it("setLspStatus no-ops when latestCtx is null", () => {
    const state = createExtensionState();

    expect(() => state.setLspStatus("accent", "LSP: ready")).not.toThrow();
    expect(state.latestCtx).toBeNull();
  });

  it("setLspStatus writes themed status into the latest context", () => {
    const setStatus = vi.fn();
    const state = createExtensionState();
    state.latestCtx = makeCtx({ setStatus });

    state.setLspStatus("accent", "LSP: ready");

    expect(setStatus).toHaveBeenCalledWith("lsp", "themed:accent:LSP: ready");
  });

  it("clears latestCtx and swallows stale-session setStatus errors", () => {
    const state = createExtensionState();
    state.latestCtx = makeCtx({
      setStatus: vi.fn(() => {
        throw new Error("ctx is stale after session shutdown");
      }),
    });

    expect(() => state.setLspStatus("warning", "LSP: starting")).not.toThrow();
    expect(state.latestCtx).toBeNull();
  });

  it("rethrows non-stale setStatus errors", () => {
    const error = new Error("status renderer failed");
    const state = createExtensionState();
    const ctx = makeCtx({
      setStatus: vi.fn(() => {
        throw error;
      }),
    });
    state.latestCtx = ctx;

    expect(() => state.setLspStatus("error", "LSP: failed")).toThrow(error);
    expect(state.latestCtx).toBe(ctx);
  });
});
