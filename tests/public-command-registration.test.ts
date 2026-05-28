import { beforeAll, describe, expect, it } from "vitest";
import lspExtension from "../src/index.js";

const collectRegisteredCommandNames = (): string[] => {
  const registeredCommandNames: string[] = [];

  const fakePi = {
    events: {
      on(_eventName: string, _handler: unknown) {},
    },
    on(_eventName: string, _handler: unknown) {},

    registerTool(_tool: unknown) {},

    registerCommand(name: string, _command: unknown) {
      registeredCommandNames.push(name);
    },
  };

  lspExtension(fakePi as any);

  return registeredCommandNames;
};

const expectedCommandNames = [
  "lsp",
  "lsp-restart",
  "lsp-config",
  "lsp-lombok",
];

describe("public command registration", () => {
  let registeredCommandNames: string[];

  beforeAll(() => {
    registeredCommandNames = collectRegisteredCommandNames();
  });

  it.each(expectedCommandNames)("registers public command %s", (expectedCommandName) => {
    expect(registeredCommandNames).toContain(expectedCommandName);
  });

  it("registers exactly the expected public commands in order", () => {
    expect(registeredCommandNames).toEqual(expectedCommandNames);
  });
});
