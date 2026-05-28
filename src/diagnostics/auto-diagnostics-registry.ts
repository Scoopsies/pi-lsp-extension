import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { isEditToolResult, isWriteToolResult } from "@earendil-works/pi-coding-agent";
import { DiagnosticSeverity, type Diagnostic } from "vscode-languageserver-protocol";
import { relative } from "node:path";
import { DIAGNOSTIC_SETTLE_DELAY_MS } from "../shared/timing.js";

interface AutoDiagnosticsProjectConfig {
  autoInjectDiagnostics?: boolean | string[];
}

interface AutoDiagnosticsClient {
  getDiagnostics(uri: string): Diagnostic[];
}

interface AutoDiagnosticsManager {
  getLanguageId(path: string): string | undefined | null;
  getRunningClient(languageId: string): AutoDiagnosticsClient | null;
  getFileUri(path: string): string;
  resolvePath(path: string): string;
}

interface AutoDiagnosticsDeps {
  getManager(): AutoDiagnosticsManager | null;
  getProjectConfig(): AutoDiagnosticsProjectConfig | null;
}

export function registerAutoDiagnostics(pi: ExtensionAPI, deps: AutoDiagnosticsDeps): void {
  pi.on("tool_result", async (event: ToolResultEvent) => {
    const manager = deps.getManager();
    if ((isWriteToolResult(event) || isEditToolResult(event)) && !event.isError && manager) {
      const path = (event.input as any)?.path;
      if (!path) return;

      const languageId = manager.getLanguageId(path);
      if (!languageId) return;

      // Check autoInjectDiagnostics config
      const inject = deps.getProjectConfig()?.autoInjectDiagnostics;
      if (inject === false) return;
      if (Array.isArray(inject) && !inject.includes(languageId)) return;

      const client = manager.getRunningClient(languageId);
      if (!client) return;

      // Wait briefly for the LSP to publish updated diagnostics
      await new Promise((r) => setTimeout(r, DIAGNOSTIC_SETTLE_DELAY_MS));

      const uri = manager.getFileUri(path);
      const diagnostics = client.getDiagnostics(uri);
      const errors = diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error);

      if (errors.length === 0) return;

      // Build a compact summary — just errors, max 10 lines
      const relPath = relative(manager.resolvePath("."), manager.resolvePath(path));
      const lines = errors.slice(0, 10).map((d) => {
        const line = d.range.start.line + 1;
        const col = d.range.start.character + 1;
        const source = d.source ? ` [${d.source}]` : "";
        return `${relPath}:${line}:${col} error: ${d.message}${source}`;
      });
      if (errors.length > 10) {
        lines.push(`... and ${errors.length - 10} more error(s)`);
      }

      const summary = `\n\n⚠ LSP: ${errors.length} error(s) in ${relPath}:\n${lines.join("\n")}`;

      return {
        content: [
          ...event.content,
          { type: "text" as const, text: summary },
        ],
      };
    }
  });
}
