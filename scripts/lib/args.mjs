export function parseArgs(argv, spec = {}) {
  const { booleans = [], strings = [], allowUnknown = false, positionalMin = 0 } = spec;
  const booleanSet = new Set(booleans);
  const stringSet = new Set(strings);

  const flags = {};
  const positional = [];
  let i = 0;
  let passthrough = false;

  while (i < argv.length) {
    const token = argv[i];
    if (passthrough) {
      positional.push(token);
      i++;
      continue;
    }
    if (token === "--") {
      passthrough = true;
      i++;
      continue;
    }
    if (token.startsWith("--")) {
      const body = token.slice(2);
      const eq = body.indexOf("=");
      const name = eq >= 0 ? body.slice(0, eq) : body;
      const inlineValue = eq >= 0 ? body.slice(eq + 1) : undefined;

      if (booleanSet.has(name)) {
        flags[name] = inlineValue == null ? true : parseBool(inlineValue);
        i++;
        continue;
      }
      if (stringSet.has(name)) {
        if (inlineValue != null) {
          flags[name] = inlineValue;
          i++;
        } else {
          const next = argv[i + 1];
          if (next == null || next.startsWith("--")) {
            throw new Error(`Flag --${name} requires a value`);
          }
          flags[name] = next;
          i += 2;
        }
        continue;
      }
      if (!allowUnknown) {
        throw new Error(`Unknown flag: --${name}`);
      }
      flags[name] = inlineValue ?? true;
      i++;
      continue;
    }
    positional.push(token);
    i++;
  }

  if (positional.length < positionalMin) {
    throw new Error(`Expected at least ${positionalMin} positional argument(s), got ${positional.length}`);
  }

  return { flags, positional };
}

function parseBool(v) {
  const s = String(v).toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return Boolean(v);
}
