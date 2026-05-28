import { describe, expect, it } from "vitest";
import lspExtension from "../src/index.js";

describe("workspace provider registration", () => {
  it("subscribes to workspace provider registration events", () => {
    const eventSubscriptions: Array<{ eventName: string; handler: unknown }> = [];

    const fakePi = {
      events: {
        on(eventName: string, handler: unknown) {
          eventSubscriptions.push({ eventName, handler });
        },
      },
      on(_eventName: string, _handler: unknown) {},
      registerTool(_tool: unknown) {},
      registerCommand(_name: string, _command: unknown) {},
    };

    lspExtension(fakePi as any);

    expect(eventSubscriptions).toContainEqual({
      eventName: "lsp:register-workspace-provider",
      handler: expect.any(Function),
    });
  });
});
