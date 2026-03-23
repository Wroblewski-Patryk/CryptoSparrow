# V1 Assistant Incident Runbook

Purpose: operational playbook for assistant-runtime incidents, deterministic fallback behavior, and safe recovery.

## Scope
- Assistant orchestration only (`main planner + up to 4 subagents`).
- Applies to `BACKTEST`, `PAPER`, and `LIVE` decision paths.
- Complements:
  - `docs/operations/v1-ops-runbook.md`
  - `docs/operations/v1-alert-rules.md`
  - `docs/operations/operator-handbook.md`

## Primary Signals to Monitor
- `GET /metrics`:
  - `assistant.subagentTimeouts`
  - `runtime.groupEvaluation.avgDurationMs`
  - `runtime.mergeOutcomes.noTrade`
  - `runtime.mergeOutcomes.long|short|exit`
- Runtime behavior:
  - sudden rise in `assistant_circuit_open` decisions
  - repeated `main_planner_failed_fail_closed`
  - decision instability across repeated dry-runs for the same setup

## Incident Types
1. `A-1 Subagent Timeout Storm`
- Symptom: rapid growth in `assistant.subagentTimeouts`.
- Impact: assistant quality degrades; increased no-trade or partial decisions.

2. `A-2 Planner Failure Loop`
- Symptom: repeated planner failures, then circuit opens.
- Impact: runtime degrades to `strategy_only`.

3. `A-3 Policy/Mandate Rejection Spike`
- Symptom: large share of `NO_TRADE` with mandate/forbidden-action reasons.
- Impact: assistant proposals blocked by policy constraints.

4. `A-4 Decision Drift`
- Symptom: inconsistent outcomes between `BACKTEST/PAPER/LIVE` for equivalent inputs.
- Impact: trust gap in execution parity and explainability.

## Immediate Containment (First 5 Minutes)
1. Confirm safety:
- If `LIVE` and decision quality is uncertain, stop bot execution path or activate kill switch.
2. Freeze changes:
- pause config edits for affected bot(s) until diagnosis is complete.
3. Capture evidence:
- export current `GET /metrics` snapshot
- capture dry-run traces from bot assistant panel
- record impacted `botId`, `botMarketGroupId`, symbols, and timestamps (UTC)
4. Apply deterministic fallback:
- Keep runtime in `strategy_only` mode for affected bots until signal quality returns.

## Fallback Modes and When to Use
1. `assistant` (normal)
- Use when planner/subagents healthy and policy-gated outcomes are stable.

2. `strategy_only` (degraded safe mode)
- Use when planner failures/timeouts exceed tolerance.
- Expected behavior: no assistant-generated directional override.

3. `off` (manual/maintenance)
- Use during prolonged incidents, config migrations, or verification windows.

## Recovery Procedure
1. Verify root cause class (`A-1..A-4`) from metrics + traces.
2. Mitigate:
- timeout storm: reduce subagent scope or timeout pressure, confirm stable latency.
- planner loop: verify planner dependency health, then retest via dry-run.
- policy spike: audit mandate/forbidden-actions and adjust bot policy config if incorrect.
- drift: run parity check and compare traces for the same orchestration input.
3. Controlled re-enable:
- switch one bot from `strategy_only` to `assistant`
- observe 15-30 minutes:
  - no timeout surge
  - no planner-failure burst
  - merge outcomes within expected profile
4. Expand rollout bot-by-bot only after stable observation.

## Operator Verification Checklist
- [ ] `assistant.subagentTimeouts` stable (no sharp burst trend)
- [ ] no repeated `assistant_circuit_open` for recovered bot
- [ ] no repeated `main_planner_failed_fail_closed`
- [ ] dry-run decision timeline available and coherent
- [ ] policy gates (`mandate_*`, `forbidden_action_*`) expected, not accidental
- [ ] if `LIVE`, post-recovery smoke checks passed in paper first

## Recommended Runtime Configuration Baseline
- `ASSISTANT_CIRCUIT_FAILURE_THRESHOLD=3`
- `ASSISTANT_CIRCUIT_RESET_MS=60000`
- Keep subagent `timeoutMs` consistent across slots per bot profile.

## Incident Closure Record
Include in post-incident note:
- incident type (`A-1..A-4`)
- affected bots and market groups
- fallback mode used and duration
- recovery validation evidence (metrics + dry-run traces)
- follow-up actions (code/config/tests/docs)
