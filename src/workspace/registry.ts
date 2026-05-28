import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { ExtensionState } from "../extension/state.js";
import type { WorkspaceProvider } from "../workspace-provider.js";

export function registerWorkspaceProvider(pi: ExtensionAPI, state: ExtensionState): void {
  const handleProvider = (provider: WorkspaceProvider) => {
    state.pendingProvider = provider;
    state.manager?.setWorkspaceProvider(provider);

    const statusText = provider.getStatusText();
    if (statusText) {
      state.setLspStatus("accent", `LSP: ${statusText}`);
    }
  };

  pi.events.on("lsp:register-workspace-provider", handleProvider as (data: unknown) => void);

  // Check for provider registered before our listener existed (load order varies).
  const existing = (pi.events as { "lsp:workspace-provider"?: WorkspaceProvider })["lsp:workspace-provider"];
  if (existing) handleProvider(existing);
}
