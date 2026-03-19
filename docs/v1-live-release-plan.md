# V1.0 Official Live Plan (World-Ready)

Goal: move from MVP to a production-grade public release (V1.0) with reliable live trading.

## Governance
- This file is the source of truth for post-MVP delivery.
- New requirements: update product/architecture/security docs first, then this plan.
- Keep tiny commits and explicit progress notes.

## V1.0 Definition
- Stable public live trading with explicit risk controls and auditability.
- Operational reliability with monitoring, alerts, and incident response.
- Reproducible deployments and rollback playbooks.
- Clear end-user and operator documentation.

## Phase A - Post-MVP Hardening
- [x] `fix(core): remove high-risk technical debt in trading-critical paths`
- [x] `refactor(engine): isolate signal/execution/risk boundaries`
- [x] `security(auth): JWT/session hardening + rotation policy`
- [x] `security(keys): API key lifecycle policy (create/rotate/revoke)`
- [x] `security(access): enforce ownership checks for all sensitive actions`
- [x] `test(regression): expand regression suite for critical flows`
- [x] `docs(security): update threat model and residual risk register`

## Phase B - Reliability, Operations, and Runtime
- [x] `feat(obs): structured logging across api/worker/exchange layers`
- [x] `feat(obs): metrics for latency, error rate, queue lag, and order failures`
- [x] `feat(obs): alert rules for failed orders, stale market data, and worker health`
- [x] `feat(ops): health/readiness endpoints for api and workers`
- [x] `feat(ops): split workers for market-data/backtest/execution`
- [x] `chore(ops): deployment runbook + rollback checklist + incident playbook`
- [x] `test(drill): run incident simulation drills and document outcomes`

## Phase C - Scale and Performance
- [x] `perf(cache): production Redis caching strategy for market and dashboard`
- [x] `perf(queue): BullMQ job model tuning for data/signal/execution`
- [x] `perf(db): indexes and query tuning for orders/positions/backtests/logs`
- [x] `perf(api): pagination/filtering standards for large datasets`
- [x] `test(load): baseline and stress tests for API/worker throughput`

## Phase D - Product Expansion to V1.0 Scope
- [ ] `feat(trading): spot trading support`
- [x] `feat(strategy): strategy import/export with format versioning`
- [ ] `feat(trading): hedge mode support`
- [ ] `feat(risk): advanced limits (daily loss/drawdown/consecutive losses)`
- [ ] `feat(risk): cooldown policies after losses`
- [ ] `feat(data): additional sources (order book/funding/open interest)`

## Phase E - UX, Trust, and Public Readiness
- [ ] `feat(ui): risk-first confirmations for all live actions`
- [x] `feat(ui): audit/log explorer with decision trace`
- [x] `feat(ui-system): harden shared dashboard design system and component documentation`
- [x] `feat(i18n): complete EN/PL parity and localization QA`
- [x] `feat(accessibility): full accessibility pass for core dashboard`
- [x] `feat(ui-theme): optional isometric visual mode for dashboard (late-stage polish, non-blocking)`
- [x] `docs(user): onboarding, safety guide, FAQ, and troubleshooting`
- [x] `docs(operator): production operations handbook`

## Phase F - Go-Live Program
- [x] `chore(release): release candidate checklist`
- [x] `chore(release): stabilization freeze window and bug bash`
- [ ] `test(e2e): full go-live smoke pack (live-safe)`
- [x] `chore(release): v1.0 tag + changelog + migration notes`
- [x] `chore(release): post-release monitoring and hotfix protocol`
- [x] `chore(release): 7-day launch review and v1.1 backlog cut`

## V1.0 Exit Criteria
- [ ] SLOs defined and observed in production.
- [ ] Incident response process tested with drills.
- [ ] Security controls audited for auth, keys, and ownership.
- [ ] Load/perf baselines met for planned public usage.
- [ ] Public docs complete for users and operators.
- [ ] Launch retrospective completed with actionable v1.1 plan.

## Progress Log
- 2026-03-15: Initialized V1.0 live release plan.
- 2026-03-15: Aligned V1.0 structure with architecture, security, testing, and release-readiness docs.
- 2026-03-15: Added optional isometric dashboard visual mode as late-stage V1 polish item.
- 2026-03-16: Hardened paper runtime loop config validation (positive interval + non-empty symbol/timeframe) with regression tests to reduce trading-critical runtime risk.
- 2026-03-16: Added JWT verification support for primary + previous secrets with strict issuer/audience checks to enable safer auth-secret rotation windows.
- 2026-03-16: Added explicit API-key lifecycle actions (`rotate`/`revoke`) with ownership enforcement and contract coverage for key-management policy.
- 2026-03-16: Redacted password hash from auth/profile read/write responses by introducing a shared public-user selector and tightening response contracts.
- 2026-03-16: Hardened ownership semantics for profile deletion by removing id-parameter delete route and validating self-only delete path with e2e coverage.
- 2026-03-16: Updated security documentation with V1 baseline threat model and residual risk register, including mitigations and explicit follow-up actions.
- 2026-03-16: Expanded regression coverage for auth middleware to include secret-rotation compatibility and strict issuer/audience claim enforcement.
- 2026-03-16: Added API `/health` and `/ready` endpoints with runtime config readiness checks as baseline for Phase B operations hardening.
- 2026-03-16: Added baseline structured API request logging (JSON payload with method/path/status/duration/timestamp) as first observability layer.
- 2026-03-16: Added explicit JWT previous-secret expiry policy (`JWT_SECRET_PREVIOUS_UNTIL`) with regression coverage for open and expired rotation windows.
- 2026-03-16: Added structured logging in exchange live-order adapter for retry, success, and terminal failure events (attempt metadata included).
- 2026-03-16: Added V1 operations runbook covering deployment gates, rollback checklist, severity model, and incident response flow.
- 2026-03-16: Added explicit API-key lifecycle policy document (create/rotate/revoke and rotation cadence) and linked it from security docs.
- 2026-03-16: Added baseline `/metrics` endpoint with cumulative HTTP counters and latency aggregates, wired through request middleware.
- 2026-03-16: Added ownership-enforcement audit baseline across sensitive modules and linked the report from security docs.
- 2026-03-16: Added baseline V1 alert-rule catalog for failed orders, stale market data, and worker-heartbeat loss with severity/action mapping.
- 2026-03-16: Reduced trading-critical runtime debt by adding explicit input guards for paper lifecycle ticks (markPrice and entry quantity) with regression tests.
- 2026-03-16: Isolated pre-trade risk evaluation into dedicated pure service to separate risk decision logic from IO/audit orchestration.
- 2026-03-16: Added worker health/readiness endpoints with split-mode queue-env checks and regression coverage.
- 2026-03-16: Completed structured logging baseline across API requests, worker runtime loop, and exchange order adapter events.
- 2026-03-16: Extended `/metrics` with exchange retry/failure counters and worker queue-lag gauges, completing latency/error/queue/order-failure metric baseline.
- 2026-03-16: Added runtime alert evaluator and `/alerts` endpoint covering order-failure spikes, stale market data, queue lag pressure, and missing worker heartbeat.
- 2026-03-16: Added dedicated market-data/backtest/execution worker entrypoints and dev scripts with heartbeat bootstrap for split-worker runtime mode.
- 2026-03-16: Added documented incident drill runs (failure spike, stale data, missing heartbeat) with outcomes and follow-up actions.
- 2026-03-16: Extended market-data caching with Redis-backed read/write path and resilient fallback to local in-memory cache.
- 2026-03-19: Standardized API pagination (`page` + `limit`) for orders, positions, and logs with validation regression tests.
- 2026-03-19: Added composite performance indexes and migration for orders/positions/backtests/logs list/filter query patterns.
- 2026-03-19: Added queue tuning profiles with env-driven overrides for market-data/backtest/execution workers and regression tests for defaults/overrides/fallback validation.
- 2026-03-19: Added baseline/stress load-test runner for API and worker monitoring endpoints, with configurable thresholds and documented execution flow.
- 2026-03-19: Started spot-support delivery by extending exchange connector with `marketType` (`future`/`spot`) runtime options and futures-only parameter guards.
- 2026-03-19: Added strategy export/import API with `strategy.v1` package versioning and ownership-safe contract coverage.
- 2026-03-19: Added production operator handbook with shift checklists, monitoring routine, safe deployment flow, and incident/operator procedures.
- 2026-03-19: Added user-facing V1 guide covering onboarding flow, safety-first rules, FAQ, troubleshooting, and live-readiness checklist.
- 2026-03-19: Completed localization QA baseline with EN/PL parity checks, locale-formatting tests, and dedicated QA checklist for release verification.
- 2026-03-19: Added optional dashboard isometric visual mode toggle with persisted preference and dedicated UI regression coverage.
- 2026-03-19: Improved accessibility in dashboard controls by hardening theme/account switcher semantics and adding screen-reader heartbeat live-region updates.
- 2026-03-19: Updated module-map documentation to include strategy import/export API contract (`strategy.v1`) for operator/dev reference.
- 2026-03-19: Added decision-trace explorer in logs dashboard with metadata drill-down panel and trace-focused filtering flow.
- 2026-03-19: Added risk-first LIVE confirmation prompts in bot create/save flows before mode/opt-in/activation changes that can enable live trading.
- 2026-03-19: Added dashboard design-system guide consolidating shared components, semantic tokens, interaction rules, and module conformance checklist.
- 2026-03-19: Completed dashboard accessibility pass with active-nav semantics (`aria-current`), updated control labels, live regions, and a dedicated audit checklist.
- 2026-03-19: Added V1 release-candidate checklist with build/runtime/security/data/docs gates and explicit cross-team sign-off criteria.
- 2026-03-19: Added stabilization freeze-window and bug-bash execution plan with severity SLAs, role ownership, and release exit gates.
- 2026-03-19: Added post-release monitoring and hotfix protocol with 7-day watch window, severity matrix, and accelerated mitigation flow.
- 2026-03-19: Added 7-day launch review template and V1.1 backlog-cut criteria for structured post-launch prioritization.
- 2026-03-19: Added V1 changelog and migration notes to support release tagging readiness and deployment communication.
- 2026-03-19: Added runnable go-live smoke-pack commands (server/client); client smoke passed, server smoke requires active Docker DB (`localhost:5432`) to complete.
- 2026-03-19: Continued spot-support rollout by adding bot-level `marketType` (`FUTURES`/`SPOT`) schema/API support with migration baseline.
- 2026-03-19: Extended spot-support groundwork to dashboard bot management UI (create/edit market type selection) with client regression coverage.
- 2026-03-19: Improved connector compatibility for spot rollout by accepting uppercase bot `marketType` aliases and normalizing to CCXT `future`/`spot` defaults.
- 2026-03-19: Improved bots dashboard operability for spot rollout by adding market filter controls and fixing market/status column mapping.
