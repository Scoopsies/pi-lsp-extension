import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import type { ProjectLspConfig } from "../config/project-config.js";
import type { ExtensionState } from "./state.js";

type LifecycleManager = {
  workspace?: { getStatusText(): string };
  getStatus?: () => unknown;
  getConfiguredLanguages?: () => unknown[];
};

type LifecycleRuntime<M extends LifecycleManager = LifecycleManager> = {
  recreate(cwd: string): Promise<unknown>;
  shutdown(): Promise<unknown>;
  getManager?: () => M;
  getTreeSitter?: () => { init(): Promise<unknown> };
  manager?: M;
  treeSitter?: { init(): Promise<unknown> };
};

type LifecycleDeps<M extends LifecycleManager = LifecycleManager> = {
  configRef: { current: ProjectLspConfig | null };
  readProjectConfig(cwd: string): ProjectLspConfig | null;
  applyProjectConfig(
    projectConfig: ProjectLspConfig | null,
    manager: M,
    setLspStatus: ExtensionState["setLspStatus"],
  ): void;
};

export function registerExtensionLifecycle<M extends LifecycleManager>(
  pi: ExtensionAPI,
  state: ExtensionState,
  runtime: LifecycleRuntime<M>,
  deps: LifecycleDeps<M>,
): void {
  pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
    state.latestCtx = ctx;

    await runtime.recreate(ctx.cwd);

    const treeSitter = getTreeSitter(runtime);
    treeSitter.init().catch((err: unknown) => {
      state.setLspStatus("warning", "LSP: tree-sitter unavailable");
      console.error(`[pi-lsp-extension] tree-sitter WASM init failed: ${errorMessage(err)}`);
    });

    const manager = getManager(runtime);
    showStartupStatus(state, manager);

    deps.configRef.current = deps.readProjectConfig(ctx.cwd);
    deps.applyProjectConfig(deps.configRef.current, manager, state.setLspStatus);
  });

  pi.on("session_shutdown", async () => {
    state.latestCtx = null;
    await runtime.shutdown();
  });
}

function getManager<M extends LifecycleManager>(runtime: LifecycleRuntime<M>): M {
  return runtime.getManager ? runtime.getManager() : runtime.manager!;
}

function getTreeSitter(runtime: LifecycleRuntime): { init(): Promise<unknown> } {
  return runtime.getTreeSitter ? runtime.getTreeSitter() : runtime.treeSitter!;
}

function showStartupStatus(state: ExtensionState, manager: LifecycleManager): void {
  const workspaceStatus = getWorkspaceStatus(manager);
  if (workspaceStatus) {
    state.setLspStatus("accent", `LSP: ${workspaceStatus}`);
    return;
  }

  state.setLspStatus("dim", `LSP: ready (${getConfiguredLanguageCount(manager)} languages configured)`);
}

function getWorkspaceStatus(manager: LifecycleManager): string | null {
  const statusText = manager.workspace?.getStatusText();
  if (statusText) return statusText;

  const status = manager.getStatus?.();
  if (status && !Array.isArray(status) && typeof status === "object" && "workspaceProviderStatus" in status) {
    const workspaceProviderStatus = (status as { workspaceProviderStatus?: unknown }).workspaceProviderStatus;
    return typeof workspaceProviderStatus === "string" && workspaceProviderStatus.length > 0
      ? workspaceProviderStatus
      : null;
  }

  return null;
}

function getConfiguredLanguageCount(manager: LifecycleManager): number {
  const configuredLanguages = manager.getConfiguredLanguages?.();
  if (Array.isArray(configuredLanguages)) return configuredLanguages.length;

  const status = manager.getStatus?.();
  if (Array.isArray(status)) return status.length;

  return 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
