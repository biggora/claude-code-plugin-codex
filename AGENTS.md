# Repository Guidelines

## Project Structure
This private Node.js ESM package provides a Codex plugin that uses Claude as a stop-time reviewer for Codex CLI turns. Plugin metadata lives in `.codex-plugin/plugin.json`. Hook definitions live in `hooks.json`. Slash commands live in `commands/*.md`. Keep executable entry points in `scripts/*.mjs` and reusable logic in `scripts/lib/*.mjs`. Local skills live in `skills/`. Unit tests live in `tests/*.test.mjs`; fixtures live in `tests/fixtures/`.

## Build, Test, and Development Commands
- `npm test`: runs `node --test --test-reporter=spec tests/*.test.mjs`.
- `npm run test:watch`: runs the unit suite in watch mode.
- `npm run test:int`: runs integration tests with `CLAUDE_REVIEW_INTEGRATION=1`; requires real Claude and Codex access.
- `npm run setup`: runs `node scripts/claude-companion.mjs setup`.

## Coding Style and Naming
Use Node `>=20.10`, ESM `.mjs` files, and `import`/`export`. Prefer named exports in `scripts/lib/*.mjs`. Match nearby style; existing source commonly uses double quotes and semicolons. Keep shared helpers in `scripts/lib/`. Keep command-facing or hook-facing entry scripts in `scripts/`.

## Testing Guidelines
Use `node:test` with `node:assert/strict`. Name tests with clear `area: behavior` descriptions, such as `parseArgs: boolean flag`. Import units from `../scripts/lib/*.mjs`. Add focused tests for security-sensitive parsing, redaction, prompt sanitization, and review behavior. When changing a specific module, keep examples close to that module's contract and avoid broad integration coverage unless the change requires it.

## Commit and PR Guidelines
Use short imperative subjects, matching the recent commit style. No PR template or repository-specific PR rules are documented. Keep PR notes concise and include the behavior changed plus the tests run.

## Security and Configuration
This plugin depends on Codex hooks, Node `>=20.10`, and either the `claude` CLI or `ANTHROPIC_API_KEY`. Preserve documented safeguards: API key redaction, prompt-injection defense, read-only Stop review with `maxToolCalls: 0`, fail-open behavior, subprocess `spawn(cmd, [args])` without a shell, and timestamped `config.toml` backups.
