type ThemeColor = "accent" | "dim" | "warning" | "error";

type ToolExecutionEndHandler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

type ToolExecutionPi = {
  on(eventName: "tool_execution_end", handler: ToolExecutionEndHandler): void;
};

type ServerStatus = {
  languageId: string;
  running: boolean;
  diagnosticsCount: number;
  errorsCount?: number;
  warningsCount?: number;
  infoCount?: number;
  hintsCount?: number;
};

type ManagerWithStatus = {
  getStatus(): ServerStatus[];
};

type SetLspStatus = (color: ThemeColor, text: string, ctx?: unknown) => void;

export function registerToolExecutionStatusUpdater(
  pi: ToolExecutionPi,
  getManagerOrNull: () => ManagerWithStatus | null,
  setLspStatus: SetLspStatus,
): void {
  pi.on("tool_execution_end", async (_event, ctx) => {
    const manager = getManagerOrNull();
    if (!manager) {
      setLspStatus("accent", "LSP: idle", ctx);
      return;
    }

    const running = manager.getStatus().filter((status) => status.running);
    if (running.length === 0) {
      setLspStatus("accent", "LSP: idle", ctx);
      return;
    }

    const langs = running.map((status) => status.languageId).join(", ");
    const totals = running.reduce(
      (counts, status) => ({
        diagnostics: counts.diagnostics + status.diagnosticsCount,
        errors: counts.errors + (status.errorsCount ?? status.diagnosticsCount),
        warnings: counts.warnings + (status.warningsCount ?? 0),
        info: counts.info + (status.infoCount ?? 0),
        hints: counts.hints + (status.hintsCount ?? 0),
      }),
      { diagnostics: 0, errors: 0, warnings: 0, info: 0, hints: 0 },
    );
    let statusText = `LSP: running (${langs})`;
    if (totals.diagnostics > 0) {
      const parts = [
        totals.errors > 0 ? `${totals.errors} error${totals.errors !== 1 ? "s" : ""}` : null,
        totals.warnings > 0 ? `${totals.warnings} warning${totals.warnings !== 1 ? "s" : ""}` : null,
        totals.info > 0 ? `${totals.info} info` : null,
        totals.hints > 0 ? `${totals.hints} hint${totals.hints !== 1 ? "s" : ""}` : null,
      ].filter(Boolean);

      statusText += ` • ${parts.join(" • ")}`;
    }

    setLspStatus("accent", statusText, ctx);
  });
}
