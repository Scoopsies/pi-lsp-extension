import type { ExtensionContext, ThemeColor } from "@earendil-works/pi-coding-agent";

import type { LspManager } from "../lsp-manager.js";
import type { WorkspaceProvider } from "../workspace-provider.js";

export interface ExtensionState {
  manager: LspManager | null;
  pendingProvider: WorkspaceProvider | null;
  latestCtx: ExtensionContext | null;
  setLspStatus(color: ThemeColor, text: string): void;
}

export function createExtensionState(): ExtensionState {
  const state: ExtensionState = {
    manager: null,
    pendingProvider: null,
    latestCtx: null,
    setLspStatus(color: ThemeColor, text: string) {
      const ctx = state.latestCtx;
      if (!ctx) return;

      try {
        setStatusForContext(ctx, color, text);
      } catch (error: unknown) {
        if (isStaleSessionError(error)) {
          state.latestCtx = null;
          return;
        }
        throw error;
      }
    },
  };
  return state;
}

function setStatusForContext(ctx: ExtensionContext, color: ThemeColor, text: string): void {
  if (!ctx.ui?.theme) return;
  ctx.ui.setStatus("lsp", ctx.ui.theme.fg(color, text));
}

function isStaleSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("stale after session");
}
