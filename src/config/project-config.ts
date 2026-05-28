import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Project-level LSP config — loaded from `.pi-lsp.json` in the workspace root.
 *
 * Example:
 * ```json
 * {
 *   "autoStart": ["java", "typescript"],
 *   "lombokJar": "env/Lombok-1.18.x/runtime/lib/lombok-1.18.42.jar",
 *   "servers": {
 *     "python": { "command": "pylsp", "args": [] }
 *   }
 * }
 * ```
 */
export interface ProjectLspConfig {
  /** Languages to start eagerly on session_start (e.g. ["java", "typescript"]) */
  autoStart?: string[];
  /** Path to Lombok jar (absolute or relative to project root). "auto" to auto-detect. */
  lombokJar?: string;
  /** Custom server configs keyed by language ID */
  servers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
  /**
   * Auto-inject LSP error diagnostics into write/edit tool results.
   * Set to false to disable, or provide an array of language IDs to enable selectively.
   * Default: true (all languages).
   *
   * Examples:
   *   true              — inject for all languages
   *   false             — never inject
   *   ["typescript"]    — only inject for TypeScript files
   */
  autoInjectDiagnostics?: boolean | string[];
}

/** Load .pi-lsp.json from a directory. Returns null if not found or invalid. */
export function readProjectConfig(dir: string): ProjectLspConfig | null {
  const configPath = join(dir, ".pi-lsp.json");
  try {
    if (!existsSync(configPath)) return null;
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as ProjectLspConfig;
  } catch {
    return null;
  }
}
