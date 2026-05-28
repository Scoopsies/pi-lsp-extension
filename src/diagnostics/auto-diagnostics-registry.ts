import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { isEditToolResult, isWriteToolResult } from "@earendil-works/pi-coding-agent";
import { DiagnosticSeverity, type Diagnostic } from "vscode-languageserver-protocol";
import { relative } from "node:path";
import type { ProjectLspConfig } from "../config/project-config.js";
import { DIAGNOSTIC_SETTLE_DELAY_MS } from "../shared/timing.js";

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
  getProjectConfig(): ProjectLspConfig | null;
  waitForDiagnosticsToSettle(): Promise<void>;
}

type AutoDiagnosticsRegistrationDeps = Omit<AutoDiagnosticsDeps, "waitForDiagnosticsToSettle"> &
  Partial<Pick<AutoDiagnosticsDeps, "waitForDiagnosticsToSettle">>;

const waitForDiagnosticsToSettle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, DIAGNOSTIC_SETTLE_DELAY_MS));

export function registerAutoDiagnostics(pi: ExtensionAPI, deps: AutoDiagnosticsRegistrationDeps): void {
  const summaryDeps: AutoDiagnosticsDeps = {
    ...deps,
    waitForDiagnosticsToSettle: deps.waitForDiagnosticsToSettle ?? waitForDiagnosticsToSettle,
  };

  pi.on("tool_result", async (event: ToolResultEvent) => {
    const summary = await buildDiagnosticSummary(event, summaryDeps);
    if (!summary) return;

    return {
      content: [
        ...event.content,
        { type: "text" as const, text: summary },
      ],
    };
  });
}

async function buildDiagnosticSummary(event: ToolResultEvent, deps: AutoDiagnosticsDeps): Promise<string | null> {
  if (!isSuccessfulChangeEvent(event)) return null;

  const manager = deps.getManager();
  if (!manager) return null;

  const path = getEventPath(event);
  if (!path) return null;

  const languageId = manager.getLanguageId(path);
  if (!languageId) return null;

  if (!isLanguageEnabled(languageId, deps.getProjectConfig())) return null;

  const client = manager.getRunningClient(languageId);
  if (!client) return null;

  // Wait briefly for the LSP to publish updated diagnostics
  await deps.waitForDiagnosticsToSettle();

  const uri = manager.getFileUri(path);
  const diagnostics = client.getDiagnostics(uri);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === DiagnosticSeverity.Error);

  if (errors.length === 0) return null;

  const relPath = relative(manager.resolvePath("."), manager.resolvePath(path));
  return formatErrorSummary(relPath, errors);
}

function isSuccessfulChangeEvent(event: ToolResultEvent): boolean {
  return (isWriteToolResult(event) || isEditToolResult(event)) && !event.isError;
}

function getEventPath(event: ToolResultEvent): string | null {
  const input: unknown = event.input;
  if (!isRecord(input)) return null;

  const path = input.path;
  return typeof path === "string" && path.length > 0 ? path : null;
}

export function isLanguageEnabled(languageId: string, projectConfig: ProjectLspConfig | null): boolean {
  const inject = projectConfig?.autoInjectDiagnostics;
  if (inject === false) return false;
  if (Array.isArray(inject) && !inject.includes(languageId)) return false;
  return true;
}

export function formatErrorSummary(relPath: string, errors: Diagnostic[]): string {
  // Build a compact summary — just errors, max 10 lines
  const lines = errors.slice(0, 10).map((diagnostic) => formatDiagnosticLine(relPath, diagnostic));
  if (errors.length > 10) {
    lines.push(`... and ${errors.length - 10} more error(s)`);
  }

  return `\n\n⚠ LSP: ${errors.length} error(s) in ${relPath}:\n${lines.join("\n")}`;
}

function formatDiagnosticLine(relPath: string, diagnostic: Diagnostic): string {
  const line = diagnostic.range.start.line + 1;
  const col = diagnostic.range.start.character + 1;
  const source = diagnostic.source ? ` [${diagnostic.source}]` : "";
  return `${relPath}:${line}:${col} error: ${diagnostic.message}${source}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
