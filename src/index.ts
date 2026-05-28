/**
 * pi-lsp-extension — Pi coding agent extension for LSP integration.
 *
 * Exposes Language Server Protocol capabilities as tools the LLM can call:
 * - lsp_diagnostics: compilation errors and warnings
 * - lsp_hover: type info and docs at a position
 * - lsp_definition: go to definition
 * - lsp_references: find all references
 * - lsp_symbols: file/workspace symbol search
 * - lsp_rename: preview rename refactoring
 * - lsp_completions: code completion suggestions at a position
 * - lsp_code_actions: quick fixes, refactorings, and source actions
 *
 * Position-based tools (hover, definition, references, rename, code_actions)
 * accept an optional `query` parameter as an alternative to line/character,
 * resolving a symbol name to its position automatically.
 *
 * Usage:
 *   1. npm install in this directory
 *   2. Add to pi via settings.json extensions, or: pi -e ./src/index.ts
 *   3. LSP servers start lazily when you first use a tool on a file
 */

import type { ExtensionAPI, ExtensionContext, ThemeColor } from "@earendil-works/pi-coding-agent";
import { LspManager } from "./lsp-manager.js";
import { registerCommands } from "./commands/registry.js";
import { registerTools } from "./tools/registry.js";
import { readProjectConfig, type ProjectLspConfig } from "./config/project-config.js";
import { applyProjectConfig } from "./config/apply-project-config.js";
import { registerExtensionLifecycle } from "./extension/session-lifecycle.js";
import { registerFileSync } from "./file-sync/registry.js";
import { registerAutoDiagnostics } from "./diagnostics/auto-diagnostics-registry.js";
import { createExtensionState } from "./extension/state.js";
import { registerWorkspaceProvider } from "./workspace/registry.js";
import { registerToolExecutionStatusUpdater } from "./status/tool-execution-status-registry.js";
import { installEpipeGuard } from "./extension/epipe-guard.js";
import { createLspRuntimeBundle } from "./extension/runtime-wiring.js";

export default function lspExtension(pi: ExtensionAPI) {
  installEpipeGuard();

  const state = createExtensionState();
  // Project config — loaded on session_start, used by auto-injection guard
  const projectConfigRef: { current: ProjectLspConfig | null } = { current: null };

  registerWorkspaceProvider(pi, state);

  const {
    runtime,
    getManager,
    getFileSync,
    managerProxy,
    treeSitterProxy,
    workspaceIndexProxy,
    getManagerOrNull,
  } = createLspRuntimeBundle(state);

  registerExtensionLifecycle<LspManager>(pi, state, runtime, {
    configRef: projectConfigRef,
    readProjectConfig,
    applyProjectConfig,
  });

  // Register all LSP tools
  // Tools call getManager() lazily so they work even if session_start hasn't fired
  registerTools(pi, managerProxy, treeSitterProxy, workspaceIndexProxy, getFileSync, getManagerOrNull);

  registerAutoDiagnostics(pi, {
    getManager: () => state.manager,
    getProjectConfig: () => projectConfigRef.current,
  });

  // File sync: track file reads/writes/edits
  registerFileSync(pi, getFileSync);

  // Update status after tool execution ends
  registerToolExecutionStatusUpdater(
    pi,
    () => state.manager,
    (color: ThemeColor, text: string, ctx?: unknown) => {
      state.latestCtx = ctx as ExtensionContext;
      state.setLspStatus(color, text);
    },
  );

  // /lsp command — show server status
  registerCommands(pi, () => state.manager, getManager);
}