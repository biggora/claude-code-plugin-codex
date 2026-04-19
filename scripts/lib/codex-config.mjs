import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { codexConfigPath } from "./paths.mjs";

export async function ensureHooksEnabled() {
  const path = codexConfigPath();
  const raw = existsSync(path) ? readFileSync(path, "utf8") : "";

  const hasSection = /^\[features\]/m.test(raw);
  const hasHooks = /^\s*codex_hooks\s*=\s*true/m.test(raw);

  if (hasHooks) return { changed: false, path };

  if (raw && existsSync(path)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(path, `${path}.bak-${ts}`);
  }

  let updated = raw;
  if (hasSection) {
    updated = updated.replace(/^\[features\]\s*\n/m, `[features]\ncodex_hooks = true\n`);
  } else {
    const prefix = updated && !updated.endsWith("\n") ? "\n" : "";
    updated = `${updated}${prefix}[features]\ncodex_hooks = true\n`;
  }

  writeFileSync(path, updated, "utf8");
  return { changed: true, path };
}

export function codexConfigState() {
  const path = codexConfigPath();
  if (!existsSync(path)) return { exists: false, hasHooks: false, path };
  const raw = readFileSync(path, "utf8");
  return {
    exists: true,
    hasHooks: /^\s*codex_hooks\s*=\s*true/m.test(raw),
    path,
  };
}
