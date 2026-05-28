let previousListeners: NodeJS.UncaughtExceptionListener[] = [];

function hasCode(error: unknown): error is { code: unknown } {
  return typeof error === "object" && error !== null && "code" in error;
}

function isEpipeError(error: unknown): boolean {
  return hasCode(error) && error.code === "EPIPE";
}

const epipeGuard: NodeJS.UncaughtExceptionListener = (error, origin) => {
  if (isEpipeError(error)) return;

  for (const listener of previousListeners) {
    listener(error, origin);
  }

  if (previousListeners.length === 0) {
    console.error("[LSP] Uncaught exception:", error);
  }
};

export function installEpipeGuard(): void {
  if (process.listeners("uncaughtException").includes(epipeGuard)) return;

  previousListeners = process.listeners("uncaughtException") as NodeJS.UncaughtExceptionListener[];
  process.on("uncaughtException", epipeGuard);
}
