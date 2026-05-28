import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createDiagnosticsTool } from "./diagnostics.js";
import { createHoverTool } from "./hover.js";
import { createDefinitionTool } from "./definition.js";
import { createReferencesTool } from "./references.js";
import { createSymbolsTool } from "./symbols.js";
import { createRenameTool } from "./rename.js";
import { createCodeActionsTool } from "./code-actions.js";
import { createCompletionsTool, syntheticDotLocks } from "./completions.js";
import { createCodeOverviewTool } from "./code-overview.js";
import { createCodeSearchTool } from "./code-search.js";
import { createCodeRewriteTool } from "./code-rewrite.js";
import type { LspManager } from "../lsp-manager.js";
import type { TreeSitterManager } from "../tree-sitter/parser-manager.js";
import type { WorkspaceIndex } from "../tree-sitter/workspace-index.js";
import type { FileSync } from "../file-sync/file-sync.js";

export function registerTools(pi: ExtensionAPI, managerProxy: LspManager, treeSitterProxy: TreeSitterManager, workspaceIndexProxy: WorkspaceIndex, getFileSync: () => FileSync, getManagerOrNull: () => LspManager | null) {
  pi.registerTool(createDiagnosticsTool(managerProxy, treeSitterProxy));
  pi.registerTool(createHoverTool(managerProxy, treeSitterProxy));
  pi.registerTool(createDefinitionTool(managerProxy, treeSitterProxy, workspaceIndexProxy));
  pi.registerTool(createReferencesTool(managerProxy, treeSitterProxy));
  pi.registerTool(createSymbolsTool(managerProxy, treeSitterProxy, workspaceIndexProxy));
  pi.registerTool(createRenameTool(managerProxy, treeSitterProxy));
  pi.registerTool(createCodeActionsTool(managerProxy, treeSitterProxy));
  pi.registerTool(createCompletionsTool(managerProxy, {
    getTrackedVersion: (uri) => getFileSync().getTrackedVersion(uri),
    setTrackedVersion: (uri, v) => getFileSync().setTrackedVersion(uri, v),
    isSyntheticDotActive: (uri) => syntheticDotLocks.has(uri),
  }, treeSitterProxy));
  const getRootDir = () => getManagerOrNull()?.resolvePath(".") ?? process.cwd();
  pi.registerTool(createCodeOverviewTool(getRootDir, treeSitterProxy, workspaceIndexProxy));
  pi.registerTool(createCodeSearchTool(getRootDir, treeSitterProxy));
  pi.registerTool(createCodeRewriteTool(getRootDir, treeSitterProxy, {
    onFileModified: (filePath: string) => {
      getFileSync().handleFileWrite(filePath).catch(() => { });
    },
  }));
}