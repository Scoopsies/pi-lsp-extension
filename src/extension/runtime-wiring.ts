import { LspManager, type LspManagerCallbacks } from "../lsp-manager.js";
import { FileSync } from "../file-sync/file-sync.js";
import { TreeSitterManager } from "../tree-sitter/parser-manager.js";
import { WorkspaceIndex } from "../tree-sitter/workspace-index.js";
import type { WorkspaceProvider } from "../workspace-provider.js";
import { syntheticDotLocks } from "../tools/completions.js";
import { createLspManagerCallbacks } from "./lsp-manager-callbacks.js";
import type { ExtensionState } from "./state.js";
import { createExtensionRuntime } from "./runtime.js";
import { createRuntimeAccessors } from "./runtime-accessors.js";

export type LspRuntimeState<M> = {
  manager: M | null;
  pendingProvider?: unknown | null;
};

export type LspRuntimeBundleOptions<M = LspManager, F = FileSync, T = TreeSitterManager, W = WorkspaceIndex> = {
  cwd?: string;
  callbacks?: LspManagerCallbacks;
  createManager?: (cwd: string, pendingProvider: unknown | null | undefined) => M;
  createFileSync?: (manager: M) => F;
  createTreeSitter?: () => T;
  createWorkspaceIndex?: (cwd: string, treeSitter: T) => W;
  isSyntheticDotLocked?: (uri: string) => boolean;
};

type ConfigurableFileSync<T, W> = {
  setSyntheticDotChecker(checker: (uri: string) => boolean): void;
  setTreeSitter(treeSitter: T, workspaceIndex: W): void;
};

export function createLspRuntimeBundle<M extends object = LspManager, F = FileSync, T extends object = TreeSitterManager, W extends object = WorkspaceIndex>(
  state: LspRuntimeState<M>,
  options: LspRuntimeBundleOptions<M, F, T, W> = {},
) {
  const isSyntheticDotLocked = options.isSyntheticDotLocked ?? ((uri: string) => syntheticDotLocks.has(uri));
  const callbacks = options.callbacks ?? createLspManagerCallbacks(state as unknown as ExtensionState);

  const runtime = createExtensionRuntime<M, F, T, W>({
    cwd: options.cwd ?? process.cwd(),
    state,
    callbacks,
    createManager: options.createManager ?? ((cwd, pendingProvider) => new LspManager(
      cwd,
      undefined,
      callbacks,
      undefined,
      pendingProvider as WorkspaceProvider | undefined,
    ) as M),
    createFileSync: options.createFileSync ?? ((manager) => new FileSync(manager as LspManager) as F),
    createTreeSitter: options.createTreeSitter ?? (() => new TreeSitterManager() as T),
    createWorkspaceIndex: options.createWorkspaceIndex ?? ((cwd, treeSitter) => new WorkspaceIndex(cwd, treeSitter as TreeSitterManager) as W),
    configureFileSync: (sync, treeSitter, workspaceIndex) => {
      const fileSync = sync as ConfigurableFileSync<T, W>;
      fileSync.setSyntheticDotChecker((uri) => isSyntheticDotLocked(uri));
      fileSync.setTreeSitter(treeSitter, workspaceIndex);
    },
  });

  return {
    runtime,
    ...createRuntimeAccessors(runtime, () => state.manager),
  };
}
