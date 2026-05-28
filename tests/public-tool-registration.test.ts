import { beforeAll, describe, expect, it } from "vitest";
import lspExtension from "../src/index.js";

const collectRegisteredToolNames = (): string[] => {
  const registeredToolNames: string[] = [];

  const fakePi = {
    events: {
      on(_eventName: string, _handler: unknown) {},
    },
    on(_eventName: string, _handler: unknown) {},

    registerTool(tool: { name?: string }) {
      registeredToolNames.push(tool.name ?? "<missing name>");
    },

    registerCommand(_name: string, _command: unknown) {},
  };

  lspExtension(fakePi as any);

  return registeredToolNames;
};

const expectedToolNames = [
  "lsp_diagnostics",
  "lsp_hover",
  "lsp_definition",
  "lsp_references",
  "lsp_symbols",
  "lsp_rename",
  "lsp_code_actions",
  "lsp_completions",
  "code_overview",
  "ast_search",
  "code_rewrite",
];

describe("public tool registration", () => {
  let registeredToolNames: string[];

  beforeAll(() => {
    registeredToolNames = collectRegisteredToolNames();
  });

  it.each(expectedToolNames)("registers public tool %s", (expectedToolName) => {
    expect(registeredToolNames).toContain(expectedToolName);
  });

  it("registers no unexpected public tools", () => {
    expect(registeredToolNames).toEqual(expectedToolNames);
  });
});
