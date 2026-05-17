import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = resolve(here, "..", "..");

export const PROMPTS_DIR = join(PLUGIN_ROOT, "prompts");
export const SCHEMAS_DIR = join(PLUGIN_ROOT, "schemas");
export const COMMANDS_DIR = join(PLUGIN_ROOT, "commands");

export function getDataRoot() {
  const fromPlugin = process.env.PLUGIN_DATA;
  if (fromPlugin) return fromPlugin;
  const fromCodex = process.env.CODEX_PLUGIN_DATA;
  if (fromCodex) return fromCodex;
  const fromClaude = process.env.CLAUDE_PLUGIN_DATA;
  if (fromClaude) return fromClaude;
  return join(homedir(), ".codex", "plugins", "claude-review", "data");
}

export function workspaceKeyFor(cwd) {
  let canonical = cwd;
  try {
    if (existsSync(cwd)) canonical = realpathSync(cwd);
  } catch {
    // keep cwd as-is
  }
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function workspaceDataDir(workspaceKey) {
  const dir = join(getDataRoot(), "state", workspaceKey);
  ensureDir(dir);
  return dir;
}

export function stateFile(workspaceKey) {
  return join(workspaceDataDir(workspaceKey), "state.json");
}

export function resultsDir(workspaceKey) {
  const dir = join(workspaceDataDir(workspaceKey), "results");
  ensureDir(dir);
  return dir;
}

export function logFile() {
  const dir = join(getDataRoot(), "logs");
  ensureDir(dir);
  return join(dir, "claude-review.log");
}

export function codexConfigPath() {
  return join(homedir(), ".codex", "config.toml");
}

function ensureDir(dir) {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
  } catch {
    // best-effort
  }
}
