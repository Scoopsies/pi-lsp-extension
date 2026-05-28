import { LspManager, type LspManagerCallbacks } from "../lsp-manager.js";
import { FileSync } from "../file-sync/file-sync.js";
import { TreeSitterManager } from "../tree-sitter/parser-manager.js";
import { WorkspaceIndex } from "../tree-sitter/workspace-index.js";
import type { WorkspaceProvider } from "../workspace-provider.js";

export type RuntimeState<M> = {
  manager: M | null;
  pendingProvider?: unknown | null;
};

type ShutdownManager = {
  shutdownAll?: () => Promise<unknown> | unknown;
};

type ShutdownTreeSitter = {
  shutdown?: () => void;
};

export type ExtensionRuntimeOptions<M = LspManager, F = FileSync, T = TreeSitterManager, W = WorkspaceIndex> = {
  cwd: string;
  state: RuntimeState<M>;
  callbacks?: LspManagerCallbacks;
  createManager?: (cwd: string, pendingProvider: unknown | null | undefined) => M;
  createFileSync?: (manager: M) => F;
  createTreeSitter?: () => T;
  createWorkspaceIndex?: (cwd: string, treeSitter: T) => W;
  configureFileSync?: (fileSync: F, treeSitter: T, workspaceIndex: W) => void;
};

export function createExtensionRuntime<M = LspManager, F = FileSync, T = TreeSitterManager, W = WorkspaceIndex>(
  options: ExtensionRuntimeOptions<M, F, T, W>,
) {
  let cwd = options.cwd;
  let fileSync: F | null = null;
  let treeSitter: T | null = null;
  let workspaceIndex: W | null = null;

  const createManager = options.createManager ?? ((root: string, pendingProvider: unknown | null | undefined) => (
    new LspManager(root, undefined, options.callbacks, undefined, pendingProvider as WorkspaceProvider | undefined) as M
  ));
  const createFileSync = options.createFileSync ?? ((manager: M) => new FileSync(manager as LspManager) as F);
  const createTreeSitter = options.createTreeSitter ?? (() => new TreeSitterManager() as T);
  const createWorkspaceIndex = options.createWorkspaceIndex ?? ((root: string, parser: T) => new WorkspaceIndex(root, parser as TreeSitterManager) as W);

  const ensureCreated = (): void => {
    if (!options.state.manager) {
      options.state.manager = createManager(cwd, options.state.pendingProvider);
      fileSync = createFileSync(options.state.manager);
      treeSitter = createTreeSitter();
      workspaceIndex = createWorkspaceIndex(cwd, treeSitter);
      options.configureFileSync?.(fileSync, treeSitter, workspaceIndex);
    }
  };

  const shutdown = async (): Promise<void> => {
    const manager = options.state.manager as (M & ShutdownManager) | null;
    if (manager?.shutdownAll) {
      await manager.shutdownAll();
    }
    const parser = treeSitter as (T & ShutdownTreeSitter) | null;
    if (parser?.shutdown) {
      parser.shutdown();
    }
    options.state.manager = null;
    fileSync = null;
    treeSitter = null;
    workspaceIndex = null;
  };

  return {
    getManager(): M {
      ensureCreated();
      return options.state.manager!;
    },
    getFileSync(): F {
      ensureCreated();
      return fileSync!;
    },
    getTreeSitter(): T {
      ensureCreated();
      return treeSitter!;
    },
    getWorkspaceIndex(): W {
      ensureCreated();
      return workspaceIndex!;
    },
    async shutdown(): Promise<void> {
      await shutdown();
    },
    async recreate(nextCwd: string): Promise<void> {
      await shutdown();
      cwd = nextCwd;
      ensureCreated();
    },
  };
}
