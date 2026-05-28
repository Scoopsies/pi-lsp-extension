import type { ProjectLspConfig } from "./project-config.js";

type StatusSetter = (level: "warning", message: string) => void;

type ProjectConfigLspManager = {
  setServerConfig(language: string, config: { command: string; args: string[]; env?: Record<string, string> }): void;
  setLombokJar(lombokJar: string): void;
  getLombokJar(): string | null | undefined;
  startEagerly(languages: string[]): void;
};

export function applyProjectConfig(
  projectConfig: ProjectLspConfig | null,
  manager: ProjectConfigLspManager,
  setLspStatus: StatusSetter,
): void {
  if (!projectConfig) return;

  // Apply custom server configs
  if (projectConfig.servers) {
    for (const [lang, serverConf] of Object.entries(projectConfig.servers)) {
      manager.setServerConfig(lang, {
        command: serverConf.command,
        args: serverConf.args ?? [],
        env: serverConf.env,
      });
    }
  }

  // Set Lombok jar path (explicit path or "auto" for auto-detection)
  if (projectConfig.lombokJar) {
    if (projectConfig.lombokJar !== "auto") {
      manager.setLombokJar(projectConfig.lombokJar);
    }
    // "auto" is the default behavior — findLombokJar() already auto-detects.
    // Setting it explicitly just confirms the user wants Lombok support.
  }

  // Auto-start configured languages in the background
  if (projectConfig.autoStart && projectConfig.autoStart.length > 0) {
    const langs = projectConfig.autoStart;
    const lombokNote = langs.includes("java") && manager.getLombokJar()
      ? ` (lombok: ${manager.getLombokJar()?.split("/").pop()})` : "";
    setLspStatus("warning", `LSP: auto-starting ${langs.join(", ")}${lombokNote}...`);
    manager.startEagerly(langs);
  }
}
