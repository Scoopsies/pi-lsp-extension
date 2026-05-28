import { describe, expect, it } from "vitest";
import { applyProjectConfig } from "../src/config/apply-project-config.js";
import type { ProjectLspConfig } from "../src/config/project-config.js";

type ServerConfigCall = {
  language: string;
  config: { command: string; args: string[]; env?: Record<string, string> };
};

class FakeLspManager {
  serverConfigCalls: ServerConfigCall[] = [];
  lombokJarCalls: string[] = [];
  startEagerlyCalls: string[][] = [];

  setServerConfig(language: string, config: ServerConfigCall["config"]) {
    this.serverConfigCalls.push({ language, config });
  }

  setLombokJar(lombokJar: string) {
    this.lombokJarCalls.push(lombokJar);
  }

  getLombokJar() {
    return this.lombokJarCalls.at(-1);
  }

  startEagerly(languages: string[]) {
    this.startEagerlyCalls.push(languages);
  }
}

describe("applyProjectConfig", () => {
  it("does nothing when project config is null", () => {
    const manager = new FakeLspManager();
    const statusCalls: Array<[string, string]> = [];

    applyProjectConfig(null, manager, (level, message) => statusCalls.push([level, message]));

    expect(manager.serverConfigCalls).toEqual([]);
    expect(manager.lombokJarCalls).toEqual([]);
    expect(manager.startEagerlyCalls).toEqual([]);
    expect(statusCalls).toEqual([]);
  });

  it("applies server configs, explicit lombok jar, autostart, and status in order", () => {
    const manager = new FakeLspManager();
    const statusCalls: Array<[string, string]> = [];
    const config: ProjectLspConfig = {
      servers: {
        typescript: { command: "typescript-language-server", args: ["--stdio"], env: { NODE_ENV: "test" } },
        python: { command: "pylsp" },
      },
      lombokJar: "/workspace/lib/lombok-1.18.42.jar",
      autoStart: ["java", "typescript"],
    };

    applyProjectConfig(config, manager, (level, message) => statusCalls.push([level, message]));

    expect(manager.serverConfigCalls).toEqual([
      {
        language: "typescript",
        config: { command: "typescript-language-server", args: ["--stdio"], env: { NODE_ENV: "test" } },
      },
      { language: "python", config: { command: "pylsp", args: [], env: undefined } },
    ]);
    expect(manager.lombokJarCalls).toEqual(["/workspace/lib/lombok-1.18.42.jar"]);
    expect(statusCalls).toEqual([["warning", "LSP: auto-starting java, typescript (lombok: lombok-1.18.42.jar)..."]]);
    expect(manager.startEagerlyCalls).toEqual([["java", "typescript"]]);
  });

  it("does not set lombok jar when configured as auto", () => {
    const manager = new FakeLspManager();
    const config: ProjectLspConfig = { lombokJar: "auto", autoStart: ["java"] };

    applyProjectConfig(config, manager, () => undefined);

    expect(manager.lombokJarCalls).toEqual([]);
    expect(manager.startEagerlyCalls).toEqual([["java"]]);
  });
});
