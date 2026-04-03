# Production Excellence Plan (2026-04-03)

Status: planned  
Owner: Platform + Runtime + Web + Ops  
Scope: hardening production behavior for runtime trading flows (`BACKTEST/PAPER/LIVE`) and dashboard observability.

## 1) Objective

Move from "works in production" to "predictable, auditable, and resilient in production":
- deterministic behavior under retries/restarts,
- no silent stalls in runtime sessions,
- clear recovery path after incidents,
- measurable SLO/SLI with actionable alerts,
- safer rollout and rollback mechanics.

## 2) Design Principles

1. Exchange truth over local assumptions (especially fees/fills/position state in LIVE).
2. Fail closed for trading decisions (no hidden fallback that can open risk).
3. Idempotent execution paths for every side-effecting command.
4. Observable by default: every critical state transition is measurable.
5. Tiny-commit rollout with explicit rollback criteria per phase.

## 3) Delivery Phases

## Phase A - Idempotency and Runtime Correctness
- [ ] `PEX-01 docs(contract): freeze idempotency contract for runtime execution commands (open/dca/close/cancel) with dedupe-key schema`
- [ ] `PEX-02 feat(api-runtime): enforce dedupe key persistence + replay-safe execution guards for side-effecting runtime actions`
- [ ] `PEX-03 test(runtime): add crash/retry regression suite proving no duplicate open/close orders after restart`

Exit criteria:
- repeated event delivery or worker restart does not duplicate execution side effects.

## Phase B - Liveness, Self-Healing, and Session Continuity
- [ ] `PEX-04 feat(runtime-watchdog): add explicit stall detector for NO_EVENT/NO_HEARTBEAT windows with classified failure reasons`
- [ ] `PEX-05 feat(runtime-recovery): implement bounded auto-restart policy with cooldown and max-attempt guardrails`
- [ ] `PEX-06 test(runtime): add long-running soak test for session continuity (heartbeat freshness, auto-restart trace, no stuck CANCELED loop)`

Exit criteria:
- runtime recovers from transient stream failures automatically and reports why.

## Phase C - Observability and Operational Signals
- [ ] `PEX-07 feat(obs-metrics): add production metrics for runtime lag, restart count, reconciliation delay, and execution error classes`
- [ ] `PEX-08 feat(obs-alerts): define alert thresholds for stale runtime, repeated restarts, and reconciliation drift`
- [ ] `PEX-09 docs(runbook): publish incident triage matrix (symptoms -> checks -> mitigations -> rollback)`

Exit criteria:
- operators can detect and triage runtime issues without digging through raw logs only.

## Phase D - Data Safety and Recoverability
- [ ] `PEX-10 feat(ops-backup): add repeatable backup verification command set for target deployment profile`
- [ ] `PEX-11 chore(ops-restore-drill): automate restore drill evidence generation with pass/fail contract`
- [ ] `PEX-12 docs(ops-rto-rpo): document RTO/RPO targets and acceptable degradation windows`

Exit criteria:
- backup and restore are verified, not assumed.

## Phase E - Secrets and Access Hardening
- [ ] `PEX-13 docs(secrets-inventory): publish canonical secret inventory + ownership + rotation cadence`
- [ ] `PEX-14 feat(security-rotation): add rotation readiness checks and startup validation for critical secrets`
- [ ] `PEX-15 test(security): add regression checks for invalid/expired secret combinations and fail-safe startup`

Exit criteria:
- secret rotation is operationally safe and testable.

## Phase F - Deployment and Release Reliability
- [ ] `PEX-16 feat(release-gates): add mandatory post-deploy runtime freshness check (bots/sessions/signals not stale)`
- [ ] `PEX-17 feat(rollback-guard): define automatic rollback trigger conditions for runtime-critical regressions`
- [ ] `PEX-18 docs(release-checklist): update deployment checklist with runtime+cache+stream validation sequence`

Exit criteria:
- bad runtime deploys are detected quickly and rolled back with deterministic criteria.

## 4) Validation Matrix

## Manual validation
1. Start PAPER bot, verify open/close and DCA actions appear with no duplicates after forced restart.
2. Simulate stream interruption, confirm runtime transitions to degraded/recovery and returns to RUNNING.
3. Confirm dashboard and bots monitoring show fresh heartbeat and non-stale session state.
4. Run backup/restore drill and verify key runtime tables integrity.

## Automated validation
- runtime idempotency test suite,
- restart and stall watchdog tests,
- deployment smoke including cache + runtime freshness assertions.

## 5) Rollout Strategy

1. Ship contracts/docs first (`PEX-01`, `PEX-09`, `PEX-12`, `PEX-13`, `PEX-18`).
2. Ship runtime guardrails in narrow slices (`PEX-02..06`) behind safe defaults.
3. Ship metrics+alerts (`PEX-07..08`) and verify in stage before prod.
4. Ship release/rollback hardening (`PEX-16..17`) after observability is live.

## 6) Out of Scope (this plan)

- New trading strategies/indicators UX expansion.
- Exchange-specific feature expansion beyond current adapter contracts.
- Admin/billing product surface work.

