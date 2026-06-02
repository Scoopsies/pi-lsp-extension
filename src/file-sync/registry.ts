import { isEditToolResult, isReadToolResult, isWriteToolResult } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import type { FileSync } from "./file-sync.js";

export async function syncFileFromToolResult(event: ToolResultEvent, getFileSync: () => FileSync): Promise<void> {
  try {
    const sync = getFileSync();

    if (isReadToolResult(event) && !event.isError) {
      const path = (event.input as any)?.path;
      if (path) await sync.handleFileRead(path);
    }

    if (isWriteToolResult(event) && !event.isError) {
      const path = (event.input as any)?.path;
      if (path) await sync.handleFileWrite(path);
    }

    if (isEditToolResult(event) && !event.isError) {
      const path = (event.input as any)?.path;
      if (path) await sync.handleFileWrite(path);
    }
  } catch {
    // File sync errors are non-fatal
  }
}

export function registerFileSync(pi: ExtensionAPI, getFileSync: () => FileSync): void {
  pi.on("tool_result", async (event) => syncFileFromToolResult(event, getFileSync));
}
