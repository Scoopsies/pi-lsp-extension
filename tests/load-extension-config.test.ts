import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readProjectConfig } from "../src/config/project-config.js";

const makeProjectDir = () => mkdtempSync(join(tmpdir(), "pi-lsp-config-"));

const writeConfig = (dir: string, contents: string) => {
  writeFileSync(join(dir, ".pi-lsp.json"), contents, "utf-8");
};

describe("readProjectConfig", () => {
  it("returns null when .pi-lsp.json is missing", () => {
    const projectDir = makeProjectDir();

    expect(readProjectConfig(projectDir)).toBeNull();
  });

  it("returns null when .pi-lsp.json contains invalid JSON", () => {
    const projectDir = makeProjectDir();
    writeConfig(projectDir, "{ invalid json");

    expect(readProjectConfig(projectDir)).toBeNull();
  });

  it("returns null when .pi-lsp.json does not contain an object", () => {
    const projectDir = makeProjectDir();
    writeConfig(projectDir, JSON.stringify("not an object"));

    expect(readProjectConfig(projectDir)).toBeNull();
  });

  it("returns valid project config object from .pi-lsp.json as-is", () => {
    const projectDir = makeProjectDir();
    const config = {
      autoStart: ["java", "typescript"],
      lombokJar: "env/lombok.jar",
      servers: {
        python: { command: "pylsp", args: ["--verbose"] },
      },
      autoInjectDiagnostics: ["typescript"],
    };
    writeConfig(projectDir, JSON.stringify(config));

    expect(readProjectConfig(projectDir)).toEqual(config);
  });
});
