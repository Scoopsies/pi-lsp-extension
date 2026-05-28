import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installEpipeGuard } from "../src/extension/epipe-guard.js";

describe("installEpipeGuard", () => {
  let originalListeners: NodeJS.UncaughtExceptionListener[];

  beforeEach(() => {
    originalListeners = process.listeners("uncaughtException") as NodeJS.UncaughtExceptionListener[];
    process.removeAllListeners("uncaughtException");
  });

  afterEach(() => {
    process.removeAllListeners("uncaughtException");
    for (const listener of originalListeners) {
      process.on("uncaughtException", listener);
    }
  });

  it("registers at most one uncaughtException listener when installed multiple times", () => {
    installEpipeGuard();
    installEpipeGuard();

    expect(process.listeners("uncaughtException")).toHaveLength(1);
  });

  it("swallows EPIPE errors without calling previous uncaughtException listeners", () => {
    const previousListener = vi.fn();
    process.on("uncaughtException", previousListener);
    const listenersBeforeInstall = process.listeners("uncaughtException");

    installEpipeGuard();

    const installedHandlers = process
      .listeners("uncaughtException")
      .filter((listener) => !listenersBeforeInstall.includes(listener));
    expect(installedHandlers).toHaveLength(1);

    installedHandlers[0]({ code: "EPIPE" } as NodeJS.ErrnoException, "uncaughtException");

    expect(previousListener).not.toHaveBeenCalled();
  });

  it("forwards non-EPIPE errors to previous uncaughtException listeners", () => {
    const previousListener = vi.fn();
    process.on("uncaughtException", previousListener);
    const listenersBeforeInstall = process.listeners("uncaughtException");
    const error = new Error("boom");

    installEpipeGuard();

    const installedHandlers = process
      .listeners("uncaughtException")
      .filter((listener) => !listenersBeforeInstall.includes(listener));
    expect(installedHandlers).toHaveLength(1);

    installedHandlers[0](error, "uncaughtException");

    expect(previousListener).toHaveBeenCalledWith(error, "uncaughtException");
  });
});
