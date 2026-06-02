import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import type { AutoDiagnosticsRegistrationDeps } from "../diagnostics/auto-diagnostics-registry.js";
import { appendAutoDiagnostics } from "../diagnostics/auto-diagnostics-registry.js";
import type { FileSync } from "../file-sync/file-sync.js";
import { syncFileFromToolResult } from "../file-sync/registry.js";

export type ToolResultPipelineDeps = AutoDiagnosticsRegistrationDeps & {
  getFileSync(): FileSync;
};

export function registerToolResultPipeline(pi: ExtensionAPI, deps: ToolResultPipelineDeps): void {
  pi.on("tool_result", async (event: ToolResultEvent) => {
    await syncFileFromToolResult(event, deps.getFileSync);
    return appendAutoDiagnostics(event, deps);
  });
}
