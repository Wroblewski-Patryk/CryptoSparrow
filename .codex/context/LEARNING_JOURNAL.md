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
