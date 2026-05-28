import type { LspManagerCallbacks } from "../lsp-manager.js";
import type { ExtensionState } from "./state.js";

export function createLspManagerCallbacks(state: ExtensionState): LspManagerCallbacks {
  return {
    onWorkspaceSetupStart: () => {
      state.setLspStatus("warning", "LSP: workspace setup...");
    },
    onWorkspaceSetupEnd: (success: boolean, duration: number) => {
      const secs = (duration / 1000).toFixed(1);
      if (success) {
        state.setLspStatus("accent", `LSP: workspace ready (${secs}s)`);
      } else {
        state.setLspStatus("warning", `LSP: workspace setup failed (${secs}s)`);
      }
    },
    onServerStart: (languageId: string, command: string) => {
      state.setLspStatus("warning", `LSP: starting ${languageId} (${command})...`);
    },
    onServerReady: (languageId: string) => {
      state.setLspStatus("accent", `LSP: ${languageId} ready`);
    },
    onServerError: (languageId: string, _error: string) => {
      state.setLspStatus("error", `LSP: ${languageId} failed`);
    },
    onServerCrash: (languageId: string, restarting: boolean, attempt: number) => {
      if (restarting) {
        state.setLspStatus("warning", `LSP: restarting ${languageId}... (attempt ${attempt}/3)`);
      } else {
        state.setLspStatus("error", `LSP: ${languageId} crashed — auto-restart exhausted`);
      }
    },
  };
}
