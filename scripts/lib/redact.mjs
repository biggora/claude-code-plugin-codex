const PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /ANTHROPIC_API_KEY\s*=\s*\S+/gi,
  /OPENAI_API_KEY\s*=\s*\S+/gi,
  /Bearer\s+[A-Za-z0-9._-]{20,}/gi,
];

export function redact(input) {
  if (input == null) return input;
  let s = typeof input === "string" ? input : String(input);
  for (const re of PATTERNS) s = s.replace(re, "***");
  return s;
}

export function redactError(err) {
  if (!err) return err;
  const message = redact(err.message ?? "");
  const stack = err.stack ? redact(err.stack) : undefined;
  const copy = new Error(message);
  if (stack) copy.stack = stack;
  if (err.code) copy.code = err.code;
  return copy;
}
