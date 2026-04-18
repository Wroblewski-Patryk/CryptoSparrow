# LEARNING_JOURNAL

Purpose: keep a compact memory of recurring execution pitfalls and verified fixes for this repository.

## Update Rules
- Add or update an entry when a failure pattern is reproducible or documented.
- Prefer updating an existing entry over creating duplicates.
- Keep entries in English and free of secrets.
- Apply the new guardrail in the same task where the learning is captured.

## Entry Template
```markdown
### YYYY-MM-DD - Short Title
- Context:
- Symptom:
- Root cause:
- Guardrail:
- Preferred pattern:
- Avoid:
- Evidence:
```

## Entries

### 2026-04-12 - PowerShell command chaining compatibility
- Context: running multi-step commands in Windows shell workflows.
- Symptom: command chains using `&&` fail in environments pinned to Windows PowerShell 5.1.
- Root cause: pipeline chain operators (`&&`, `||`) are available in PowerShell 7+, not in Windows PowerShell 5.1.
- Guardrail: use sequential commands with explicit exit-code checks for compatibility.
- Preferred pattern:
```powershell
pnpm lint
if ($LASTEXITCODE -eq 0) { pnpm test }
if ($LASTEXITCODE -eq 0) { pnpm -r build }
```
- Avoid: `pnpm lint && pnpm test && pnpm -r build`
- Evidence:
  - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pipeline_chain_operators?view=powershell-7.5
  - Team-reported failure pattern in this repository workflow on Windows.

### 2026-04-15 - ripgrep access denied in this workspace
- Context: repository exploration on Windows PowerShell in Codex desktop environment.
- Symptom: `rg --files <path>` fails with `Program 'rg.exe' failed to run: Access denied`.
- Root cause: environment-level execution restriction for `rg.exe` in this session.
- Guardrail: fallback to PowerShell-native discovery commands when `rg` is unavailable or blocked.
- Preferred pattern:
```powershell
Get-ChildItem -Recurse -File <path> | ForEach-Object { $_.FullName }
```
- Avoid: retry loops with `rg` after first deterministic `Access denied` failure.
- Evidence:
  - Observed on 2026-04-15 while inspecting `apps/web/src/features/*` directories in this repository.
  - Reconfirmed on 2026-04-16 while triaging `apps/api/src/modules/engine/*` and `apps/api/src/modules/market-stream/*`; `Select-String` fallback worked without retries.

### 2026-04-15 - PowerShell 5.1 UTC timestamp compatibility
- Context: generating timestamped evidence artifact names in Windows PowerShell shell scripts.
- Symptom: `Get-Date -AsUTC` fails with parameter binding error in this environment.
- Root cause: `-AsUTC` is not available in Windows PowerShell 5.1.
- Guardrail: use explicit conversion with `.ToUniversalTime()` when building UTC file-name timestamps.
- Preferred pattern:
```powershell
$ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ss-fffZ')
```
- Avoid: `Get-Date -AsUTC -Format ...`
- Evidence:
  - Observed on 2026-04-15 while generating `docs/operations/_artifacts-docs-parity-*.json` in this repository.

### 2026-04-16 - Long soak load-test summary overflow
- Context: running 30-minute load soak via `apps/api/scripts/load-test.mjs`.
- Symptom: process exits with `RangeError: Maximum call stack size exceeded` at summary stage (`Math.min(...result.latenciesMs)` / `Math.max(...result.latenciesMs)`).
- Root cause: spread operator over very large latency arrays exceeds call stack for long/high-throughput runs.
- Guardrail: for 30-minute soak evidence, always persist pre/post `/metrics` snapshots and raw load output; treat script summary as optional unless load-test implementation is hardened.
- Preferred pattern:
```powershell
# capture pre/post metrics + raw runner output as primary evidence
# do not rely only on load-test JSON summary for long windows
```
- Avoid: using spread (`Math.min(...arr)`, `Math.max(...arr)`) over unbounded large arrays in long-duration load runners.
- Evidence:
  - Observed on 2026-04-16 in `docs/operations/_artifacts-cpdb24-soak-2026-04-16T02-03-29-605Z.json` (`RangeError` in `apps/api/scripts/load-test.mjs`).

### 2026-04-16 - API e2e shared-db concurrency collision
- Context: running multiple API e2e files in one `vitest` invocation against the shared local test database.
- Symptom: suites that pass individually fail in batch with FK cleanup errors (for example `BacktestRun_userId_fkey` during `wallets.crud.e2e` teardown).
- Root cause: file-level parallel execution causes cleanup order races between suites that mutate overlapping relational tables.
- Guardrail: run DB-mutating API e2e suites sequentially per file for planning/QA evidence runs unless an isolated database per worker is configured.
- Preferred pattern:
```powershell
pnpm --filter api test -- src/modules/strategies/strategies.e2e.test.ts
if ($LASTEXITCODE -eq 0) { pnpm --filter api test -- src/modules/wallets/wallets.crud.e2e.test.ts }
if ($LASTEXITCODE -eq 0) { pnpm --filter api test -- src/modules/bots/bots.wallet-contract.e2e.test.ts }
```
- Avoid: bundling several DB-mutating e2e files into a single `vitest` call in this environment.
- Evidence:
  - Reproduced on 2026-04-16 while executing WLT-23 QA pack; grouped run failed with FK cleanup collisions, sequential per-file execution passed.

### 2026-04-17 - Coolify secret-env mount requires Dockerfile syntax 1.10
- Context: Docker builds on Coolify with "Use Docker Build Secrets" enabled.
- Symptom: deployment fails early during Dockerfile parse/solve with errors like `unexpected key 'env' in 'env=COOLIFY_URL'`, often before app build steps run.
- Root cause: Coolify injects `RUN --mount=type=secret,...,env=...` options that are not supported by Dockerfile frontend `1.7`.
- Guardrail: keep all deploy Dockerfiles on `# syntax=docker/dockerfile:1.10` (or newer) when builds can receive Coolify secret mounts.
- Preferred pattern:
```Dockerfile
# syntax=docker/dockerfile:1.10
FROM node:20-bookworm-slim
```
- Avoid: mixing Coolify build-secret injection with Dockerfile frontend `1.7`.
- Evidence:
  - Local reproduction on 2026-04-17: minimal Dockerfile with `1.7` + `--mount=type=secret,env=...` failed with `unexpected key 'env'`; same file with `1.10` succeeded.
  - Applied across `apps/api/Dockerfile*` and `apps/web/Dockerfile` in this repository.

### 2026-04-17 - SCOPE LOCK, SMALL COMMITS, GROUP-END PUSH
- Context: UI/task execution in planning waves.
- Symptom: unnecessary rework caused by changing UI detail (footer language-switcher flags) without explicit request and by oversized multi-topic commits.
- Root cause: assumption-driven change beyond requested scope + bundling too many concerns in one commit.
- Guardrail:
  - `IF NOT EXPLICITLY REQUESTED, DO NOT CHANGE IT.`
  - `ONE TASK GROUP -> SMALL SCOPE-LOCKED COMMITS -> PUSH AFTER LAST COMMIT IN THAT GROUP.`
- Preferred pattern:
```text
SCOPE LOCK: implement only explicitly requested behavior.
If unsure, leave existing UI/UX unchanged.
Bridge/add-on changes are allowed only when required by failing tests/build/contracts for the requested feature.
Prefer smaller, single-purpose commits over large mixed commits.
After completing the full planned group: push immediately after the final commit.
```
- Avoid: "cleanup" or visual tweaks not listed in task acceptance criteria.
- Evidence:
  - User-reported rework caused by unnecessary footer language-switcher flag change (2026-04-17).
  - User feedback that large, multi-thread commits increase drift risk and rework (2026-04-17).

### 2026-04-17 - PLANNING SOURCE-OF-TRUTH CROSS-CHECK
- Context: answering "what is planned next" in a repository with both canonical queues and historical checklists/templates.
- Symptom: assistant reports "nothing planned" from canonical queue, while other docs still contain unchecked boxes; later tasks are rediscovered and cause context churn.
- Root cause: no explicit two-tier planning read (active canonical queue vs non-canonical/historical docs) before status response.
- Guardrail:
  - `BEFORE SAYING "NO TASKS PLANNED", RUN TWO-TIER CHECK:`
  - `TIER 1 (ACTIVE): canonical planning files only.`
  - `TIER 2 (BACKGROUND): all docs unchecked items, explicitly labeled as historical/template/non-active when applicable.`
- Preferred pattern:
```text
When user asks "what is planned":
1) Report ACTIVE queue from canonical files.
2) Separately report any non-canonical open checklists as "background/historical".
3) If mismatch exists, propose sync/archival update to avoid future drift.
```
- Avoid: collapsing all unchecked boxes into one queue or ignoring non-canonical unchecked docs entirely.
- Evidence:
  - Observed mismatch on 2026-04-17: canonical planning files had 0 open tasks while legacy docs still had many unchecked checklists (including EXCTX/VPS readiness artifacts).

### 2026-04-17 - Planning must activate executable NOW queue
- Context: user asks for a large implementation plan and expects executor to start immediately with `start` intent.
- Symptom: executor reports "nothing to do" even when a detailed plan document exists.
- Root cause: plan was documented, but canonical execution queue (`mvp-next-commits.md`) and fallback source (`mvp-execution-plan.md`) were not populated with active unchecked task commits.
- Guardrail: every new wave plan must be followed in the same turn by queue activation in canonical planning files.
- Preferred pattern:
```text
1) Write detailed wave plan file.
2) Promote first 3-5 concrete commit tasks to `NOW`.
3) Place next slice in `NEXT`, remaining slice in `PIPELINE`.
4) Mirror unchecked tasks in `mvp-execution-plan.md` so automatic refill works.
5) Add grouped batch map (A/B/C/...) for executor clarity.
```
- Avoid: leaving `NOW/NEXT/PIPELINE` as `none` after publishing a new plan.
- Evidence:
  - 2026-04-17 user report: executor had no actionable tasks despite existing UXR plan.

### 2026-04-18 - Next.js typecheck depends on fresh `.next/types` snapshot
- Context: running `pnpm --filter web run typecheck` during closure packs.
- Symptom: `tsc --noEmit` fails with many `TS6053` missing files under `apps/web/.next/types/app/...` despite unchanged route files.
- Root cause: web tsconfig includes `.next/types/**/*.ts`; if a prior `next build` fails before finishing type generation (for example lint error), cached `.next/types` can become stale/incomplete.
- Guardrail: in closure/CI-like verification, run `pnpm --filter web run build` (or `next typegen`) before final standalone `typecheck` when route tree changed or after interrupted builds.
- Preferred pattern:
```powershell
pnpm --filter web run build
if ($LASTEXITCODE -eq 0) { pnpm --filter web run typecheck }
```
- Important: do not run `web build` and `web typecheck` in parallel in this repo;
  parallel execution can race on `.next/types` generation and cause false `TS6053`.
- Avoid: treating missing `.next/types` errors as app-code regressions before refreshing Next.js generated types.
- Evidence:
  - Observed on 2026-04-18 during `L10NQ-D-18`: `typecheck` failed with missing `.next/types/app/...`; after fixing build blocker and running `next build`, `typecheck` passed.

### 2026-04-18 - Sandbox `spawn EPERM` for `next build` / `vitest` requires escalation
- Context: running web validation commands in Codex desktop `workspace-write` sandbox.
- Symptom: `next build` and `vitest` fail early with `Error: spawn EPERM` (esbuild/child-process startup), and follow-up checks (`tsc`) can fail from stale/missing `.next/types`.
- Root cause: sandbox process-spawn restriction for toolchain subprocesses in this environment.
- Guardrail: if build/test commands fail with `spawn EPERM`, rerun those exact commands with `require_escalated`; then rerun `tsc --noEmit` after successful `next build`.
- Preferred pattern:
```text
1) Run next build (if EPERM -> rerun with escalation).
2) Run focused vitest pack (if EPERM -> rerun with escalation).
3) Run tsc --noEmit after build to validate `.next/types`.
```
- Avoid: treating `spawn EPERM` as application-code failure or closing a QA task before retrying with escalation.
- Evidence:
  - Observed on 2026-04-18 during `UXR-E-12` closure pack; non-escalated `next/vitest` failed with `spawn EPERM`, escalated reruns passed (`next build` PASS, focused Vitest pack `30/30` PASS).
