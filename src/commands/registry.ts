import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager, ServerConfig } from "../lsp-manager.js";

type ManagerLookup = (() => LspManager | null) | LspManager | null;

export function registerCommands(pi: ExtensionAPI, getManagerOrNull: ManagerLookup, getManager: () => LspManager) {
  const getCurrentManager = (): LspManager | null => {
    if (typeof getManagerOrNull === "function") return getManagerOrNull();
    return getManagerOrNull ?? getManager();
  };
  pi.registerCommand("lsp", {
    description: "Show LSP server status",
    handler: async (_args, ctx) => {
      const manager = getCurrentManager();
      if (!manager) {
        ctx.ui.notify("LSP manager not initialized", "warning");
        return;
      }

      (manager as unknown as { getAllDiagnostics?: () => unknown }).getAllDiagnostics?.();
      const statuses = manager.getStatus();
      if (statuses.length === 0) {
        ctx.ui.notify("No LSP servers configured", "info");
        return;
      }

      const lines = statuses.map((s) => {
        const icon = s.running ? "🟢" : "⚪";
        const diags = s.diagnosticsCount > 0 ? ` (${s.diagnosticsCount} diagnostics)` : "";
        const shared = s.shared ? " [shared]" : "";
        return `${icon} ${s.languageId}: ${s.command}${diags}${shared}`;
      });

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // /lsp-restart command — restart a specific language server
  pi.registerCommand("lsp-restart", {
    description: "Restart an LSP server: /lsp-restart <language> (e.g. java, typescript)",
    handler: async (args, ctx) => {
      const manager = getCurrentManager();
      if (!manager) {
        ctx.ui.notify("LSP manager not initialized", "warning");
        return;
      }

      const languageId = args?.trim().toLowerCase();
      if (!languageId) {
        // Show running servers and usage
        const statuses = manager.getStatus().filter((s) => s.running);
        if (statuses.length === 0) {
          ctx.ui.notify("No LSP servers are running.\n\nUsage: /lsp-restart <language>", "info");
        } else {
          const langs = statuses.map((s) => s.languageId).join(", ");
          ctx.ui.notify(
            `Running servers: ${langs}\n\nUsage: /lsp-restart <language>\nExample: /lsp-restart java`,
            "info"
          );
        }
        return;
      }

      ctx.ui.setStatus("lsp", ctx.ui.theme.fg("warning", `LSP: restarting ${languageId}...`));
      ctx.ui.notify(`Restarting ${languageId} server (kills daemon if shared)...`, "info");

      try {
        await manager.restartServer(languageId);
        const lombokJar = languageId === "java" ? manager.getLombokJar() : null;
        const lombokNote = lombokJar ? `\nLombok: ${lombokJar}` : "";
        ctx.ui.notify(`${languageId} server restarted successfully.${lombokNote}`, "info");
        ctx.ui.setStatus("lsp", ctx.ui.theme.fg("accent", `LSP: ${languageId} ready`));
      } catch (err: any) {
        ctx.ui.notify(`Failed to restart ${languageId}: ${err.message}`, "error");
        ctx.ui.setStatus("lsp", ctx.ui.theme.fg("error", `LSP: ${languageId} restart failed`));
      }
    },
  });

  // /lsp-config command — add or override server configuration
  pi.registerCommand("lsp-config", {
    description: "Configure an LSP server: /lsp-config <language> <command> [args...]",
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify(
          "Usage: /lsp-config <language> <command> [args...]\nExample: /lsp-config python pylsp",
          "info"
        );
        return;
      }

      const parts = args.trim().split(/\s+/);
      if (parts.length < 2) {
        ctx.ui.notify(
          "Usage: /lsp-config <language> <command> [args...]",
          "warning"
        );
        return;
      }

      const [languageId, command, ...serverArgs] = parts;
      const config: ServerConfig = { command, args: serverArgs };

      getManager().setServerConfig(languageId, config);
      ctx.ui.notify(
        `Configured LSP for ${languageId}: ${command} ${serverArgs.join(" ")}`,
        "info"
      );
    },
  });

  // /lsp-lombok command — set Lombok jar path for Java
  pi.registerCommand("lsp-lombok", {
    description: "Set Lombok jar path for Java: /lsp-lombok <path-to-lombok.jar>",
    handler: async (args, ctx) => {
      const mgr = getManager();

      if (!args?.trim()) {
        const current = mgr.getLombokJar();
        if (current) {
          ctx.ui.notify(`Lombok jar: ${current}`, "info");
        } else {
          ctx.ui.notify(
            "No Lombok jar configured or detected.\n\n" +
            "Usage: /lsp-lombok <path-to-lombok.jar>\n" +
            "Or set LOMBOK_JAR environment variable.\n\n" +
            "Download from: https://projectlombok.org/download",
            "info"
          );
        }
        return;
      }

      const jarPath = args.trim();
      const { existsSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const resolved = resolve(ctx.cwd, jarPath);

      if (!existsSync(resolved)) {
        ctx.ui.notify(`File not found: ${resolved}`, "error");
        return;
      }

      if (!resolved.endsWith(".jar")) {
        ctx.ui.notify(`Warning: ${resolved} doesn't end in .jar — setting anyway`, "warning");
      }

      mgr.setLombokJar(resolved);
      ctx.ui.notify(`Lombok jar set: ${resolved}`, "info");
    },
  });
}