type ThemeColor = "accent" | "dim" | "warning" | "error";

type ToolExecutionEndHandler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

type ToolExecutionPi = {
  on(eventName: "tool_execution_end", handler: ToolExecutionEndHandler): void;
};

type ServerStatus = {
  languageId: string;
  running: boolean;
  diagnosticsCount: number;
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
    const totalDiags = running.reduce((count, status) => count + status.diagnosticsCount, 0);
    let statusText = `LSP: running (${langs})`;
    if (totalDiags > 0) {
      statusText += ` • ${totalDiags} error${totalDiags !== 1 ? "s" : ""}`;
    }

    setLspStatus("accent", statusText, ctx);
  });
}
