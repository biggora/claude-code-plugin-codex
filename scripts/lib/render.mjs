const NO_COLOR = process.env.NO_COLOR != null || process.env.CLAUDE_REVIEW_NO_COLOR != null;

const codes = {
  reset: 0,
  bold: 1,
  dim: 2,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  gray: 90,
};

function style(name, text) {
  if (NO_COLOR) return text;
  const c = codes[name];
  if (c == null) return text;
  return `\u001b[${c}m${text}\u001b[0m`;
}

export const color = new Proxy(
  {},
  {
    get(_t, name) {
      return (text) => style(String(name), String(text));
    },
  },
);

export function renderReviewOneLine({ verdict, reason, transport, latencyMs }) {
  const label =
    verdict === "allow"
      ? color.green("ALLOW")
      : verdict === "block"
        ? color.red("BLOCK")
        : verdict === "skip"
          ? color.dim("SKIP")
          : color.yellow(String(verdict).toUpperCase());
  const meta = [];
  if (transport) meta.push(color.gray(transport));
  if (typeof latencyMs === "number") meta.push(color.gray(`${latencyMs}ms`));
  const metaStr = meta.length ? ` (${meta.join(", ")})` : "";
  const reasonStr = reason ? ` ${reason.slice(0, 200)}` : "";
  return `${label}${metaStr}${reasonStr}`;
}

export function renderReviewBlock(result) {
  const header = renderReviewOneLine(result);
  if (result.verdict !== "block") return header;
  const body = (result.fullText ?? result.reason ?? "").split(/\r?\n/).slice(0, 40);
  return [header, "", ...body.map((l) => `  ${l}`)].join("\n");
}

export function renderJobList(jobs) {
  if (!jobs || jobs.length === 0) return color.dim("no tracked jobs");
  const rows = jobs.map((j) => {
    const status = j.finishedAt ? (j.exitCode === 0 ? color.green("done") : color.red("exit=" + j.exitCode)) : color.yellow("running");
    return `  ${color.bold(j.id)}  ${color.gray(j.kind)}  ${status}  ${color.dim(j.startedAt ?? "")}`;
  });
  return [color.bold("jobs:"), ...rows].join("\n");
}

export function renderFindings(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return color.dim("no findings");
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sorted = [...findings].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return sorted
    .map((f) => {
      const sev =
        f.severity === "critical" || f.severity === "high"
          ? color.red(f.severity.toUpperCase())
          : f.severity === "medium"
            ? color.yellow(f.severity.toUpperCase())
            : color.gray(f.severity?.toUpperCase() ?? "INFO");
      const loc = f.file ? ` ${color.cyan(f.file + (f.line_start ? `:${f.line_start}` : ""))}` : "";
      const conf = typeof f.confidence === "number" ? color.dim(` (${Math.round(f.confidence * 100)}%)`) : "";
      const head = `${sev}${loc}${conf}  ${color.bold(f.title ?? "")}`;
      const detail = f.detail ? `\n    ${f.detail.replace(/\n/g, "\n    ")}` : "";
      const sug = f.suggestion ? `\n    ${color.dim("→ " + f.suggestion.replace(/\n/g, "\n      "))}` : "";
      return head + detail + sug;
    })
    .join("\n\n");
}

export function renderAdversarialResult(obj) {
  if (!obj || typeof obj !== "object") return color.red("Invalid review output");
  const verdictLine =
    obj.verdict === "allow"
      ? color.green("VERDICT: allow")
      : color.red("VERDICT: block");
  const parts = [verdictLine];
  if (obj.summary) parts.push(color.bold("Summary:") + " " + obj.summary);
  if (obj.findings) parts.push("", color.bold("Findings:"), renderFindings(obj.findings));
  if (obj.next_action) parts.push("", color.bold("Next action:"), "  " + obj.next_action);
  return parts.join("\n");
}
