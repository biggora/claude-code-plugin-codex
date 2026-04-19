import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPTS_DIR } from "./paths.mjs";

const cache = new Map();

export function loadPrompt(name) {
  const key = name.endsWith(".md") ? name : `${name}.md`;
  if (cache.has(key)) return cache.get(key);
  const full = join(PROMPTS_DIR, key);
  const body = readFileSync(full, "utf8");
  cache.set(key, body);
  return body;
}

export function interpolate(template, vars, { strict = true } = {}) {
  const seen = new Set();
  const output = template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, key) => {
    seen.add(key);
    if (!(key in vars)) {
      if (strict) throw new Error(`Missing prompt variable: ${key}`);
      return "";
    }
    return String(vars[key] ?? "");
  });
  return output;
}

export function sanitizeCodexBlock(raw) {
  if (raw == null) return "";
  const s = typeof raw === "string" ? raw : String(raw);
  return s.replace(/<\/codex_response\s*>/gi, "<!-- escaped:/codex_response -->");
}
