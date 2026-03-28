# V1.0 Official Live Plan (World-Ready)

Goal: move from MVP to a production-grade public release (V1.0) with reliable live trading.

## Governance
- This file is the source of truth for post-MVP delivery.
- New requirements: update product/architecture/security docs first, then this plan.
- Keep tiny commits and explicit progress notes.

## Current Status (2026-03-21)
- Implementation track is largely complete across Phases A-F.
- Remaining work is production-environment exit validation (SLO observation window + external release gates/sign-offs).
- Scope note (2026-03-22): unresolved admin+billing implementation items are explicitly moved to post-MVP/V1.1; V1 focuses on runtime/live-trading integrity and truthful release evidence.

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
- [x] `feat(trading): spot trading support`
- [x] `feat(strategy): strategy import/export with format versioning`
- [x] `feat(trading): hedge mode support`
- [x] `feat(risk): advanced limits (daily loss/drawdown/consecutive losses)`
- [x] `feat(risk): cooldown policies after losses`
- [x] `feat(data): additional sources (order book/funding/open interest)`

## Phase E - UX, Trust, and Public Readiness
- [x] `feat(ui): risk-first confirmations for all live actions`
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
- [x] `test(e2e): full go-live smoke pack (live-safe)`
- [x] `chore(release): v1.0 tag + changelog + migration notes`
- [x] `chore(release): post-release monitoring and hotfix protocol`
- [x] `chore(release): 7-day launch review and v1.1 backlog cut`

## Exit Evidence Workpack (Open)
- [ ] `ops(slo): define SLO targets and collect production observation window evidence`
- [x] `test(drill): execute incident drills in production-like environment and publish outcomes`
- [x] `security(audit): complete final auth/ownership/key audit sign-off`
- [x] `test(load): publish load/performance evidence against target thresholds`
- [x] `docs(public): finalize user/operator public documentation set for launch`
- [x] `release(review): complete launch retrospective and produce V1.1 prioritized backlog`
## V1.0 Exit Criteria
- [ ] SLOs defined and observed in production.
- [x] Incident response process tested with drills.
- [x] Security controls audited for auth, keys, and ownership.
- [x] Load/perf baselines met for planned public usage.
- [x] Public docs complete for users and operators.
- [x] Launch retrospective completed with actionable v1.1 plan.

## Phase G - Unified Runtime and Bot-Control Program (Post-V1.0 Hardening Track)
Objective: deliver deterministic runtime parity across `BACKTEST`, `PAPER`, and `LIVE`, plus explicit control over manually opened exchange positions.

### G0 - Audit-Driven Truth and Quality Gate
- [x] `docs(sync): remove contradictory done/pending markers and align plan claims with repository evidence`
- [x] `test(core): restore green core tests before declaring stability gates complete`
- [x] `docs(scope): keep admin/billing in post-MVP/V1.1 and remove implied V1 delivery claims`

### G1 - Navigation and Domain Surface Alignment
- [x] `feat(ui-nav): rename Execution group to Bots and move Orders/Positions under Exchanges in main dashboard IA`
- [x] `fix(ui-header): center desktop nav list and unify header interaction styling (hover/active/focus) across menu/account/language/theme controls`
- [x] `fix(ui-language): correct EN/PL flag visuals and protect with regression tests`
- [x] `audit(routing): canonicalize dashboard URL contract and remove duplicate/legacy route variants`
- [x] `docs(ia): update module map and user guide navigation references for Bots/Exchanges grouping`

### G2 - Position/Order Origin and Management Semantics
- [x] `feat(db): add origin/management metadata to positions/orders/trades (bot/manual/exchange-sync/backtest)`
- [x] `feat(api): expose management mode in positions endpoints and allow explicit toggle manual<->bot managed`
- [x] `feat(profile): add API-key onboarding options for external sync and external position management defaults`

### G3 - Live Reconciliation and Safety Rules
- [x] `feat(runtime): implement live reconciliation loop with exchange as source-of-truth and DB upsert projection`
- [x] `feat(runtime): enforce no-flip rule on per-symbol position lifecycle and ignore opposite entries while position is open`
- [x] `feat(runtime): ignore bot entry signals on symbols occupied by manual-managed positions`

### G4 - Shared Execution Core (Parity Foundation)
- [x] `refactor(engine): extract shared execution core used by backtest/paper/live adapters`
- [x] `refactor(engine): route runtime signal and position automation flows through shared execution core`
- [x] `test(engine): add deterministic parity tests for shared core against mode adapters`

### G5 - Paper 1:1 Live-Semantics Simulation
- [x] `feat(paper): implement realistic fill model (partial fills, latency, fee/slippage/funding)`
- [x] `feat(paper): persist runtime-equivalent order/position/trade events for performance analytics`
- [x] `test(paper): add scenario tests proving paper/live decision equivalence with adapter-specific execution differences only`

### G6 - Backtest 1:1 Runtime Replay
- [x] `feat(backtest): replace reduced simulation path with shared execution core replay over historical candles`
- [x] `feat(backtest): ensure all runtime lifecycle actions are represented in events/timeline/report (entry/exit/dca/tp/sl/trailing)`
- [x] `perf(backtest): implement historical candle DB cache with incremental backfill and deterministic chunk replay`

### G7 - Performance and Analytics Closure
- [x] `feat(metrics): add cross-mode performance comparison views (backtest vs paper vs live)`
- [x] `feat(positions): show position source and management mode in Positions table and details`
- [x] `test(e2e): strategy->bot->backtest/paper/live parity path with runtime assertions and reconciliation checks`

### G8 - Auth and Platform Surface Cleanup
- [x] `fix(auth-session): auto-logout user on invalid token/deleted-user/no-db startup and keep public-route UX clean`
- [x] `feat(auth-ui): add password visibility toggles on login/register with accessibility semantics`
- [x] `fix(ui-theme): remove isometric toggle from active V1 account menu (defer to V2 gamification path)`
- [x] `docs(repo): finalize migration plan from apps/web+apps/api to apps/web+apps/api and bootstrap apps/mobile`

### G9 - Live Semantics and Ops Security Completion
- [x] `fix(live-contract): enforce LIVE real-exchange side effects with no local-only simulation on execution path`
- [x] `feat(stream-contract): complete stream contract with event id, heartbeat/ping, and symbol-limit safeguards`
- [x] `security(ops): restrict /metrics, /alerts, /workers/* to authorized operational contexts`
- [x] `refactor(rate-limit): migrate throttling model from mostly IP-centric to user/exchange-key aware controls`

### G10 - Deterministic Cross-Mode Strategy Parity (Active)
- [x] `G10-01 contract: freeze shared strategy-evaluation contract used by runtime and backtests (open/close/additional semantics)`
- [x] `G10-02 engine: remove remaining backtest-only signal shortcuts and keep single shared evaluator as source of truth`
- [x] `G10-03 replay: align backtest replay inputs with runtime inputs (ohlcv + funding/open-interest where available)`
- [x] `G10-04 parity-tests: add deterministic 3-symbol parity harness comparing decision traces across BACKTEST/PAPER/LIVE`
- [x] `G10-05 parity-reporting: publish mismatch diagnostics (timestamp, side, trigger, reason) in operator-visible report`
- [x] `G10-06 qa-manual: define Binance side-by-side verification playbook for same interval/indicators/symbol set`
- [x] `G10-07 parity-e2e: add strategy + market-group(3 symbols) + backtest report + paper pre-trade consistency contract`
- [x] `G10-08 parity-perf: reduce multi-symbol markets-tab memory pressure without hiding chart cards`
- [x] `G10-09 parity-runbook: publish operator protocol for mismatch interpretation and safe corrective actions`
- [x] `G10-10 parity-report-hardening: include per-symbol processed/failed status + error diagnostics for operator triage`
- [x] `G10-11 parity-ui: display per-symbol parity processing status/error in Markets tab for operator visibility`
- [x] `G10-12 parity-ui-quality: fix reports module api import contract to keep web typecheck/build gate clean`
- [x] `G10-13 parity-api-contract: enforce run-scoped timeline symbol access and return 404 for out-of-scope symbols`

## Progress Log
- 2026-03-28: Added Phase G10 parity-closure workstream to finish deterministic strategy behavior across BACKTEST/PAPER/LIVE and support Binance side-by-side verification.
- 2026-03-28: Completed `G10-01` by publishing `strategy-evaluation-parity-contract.md` and referencing it from open decisions.
- 2026-03-28: Completed `G10-02` by removing strategy-mode threshold fallback in backtest replay and enforcing shared evaluator semantics for strategy runs.
- 2026-03-28: Completed `G10-03` by routing replay settlement through shared simulator accounting and historical fill-model adapter with fee/slippage/funding inputs.
- 2026-03-28: Extended `G10-03` data parity by adding futures historical funding/open-interest ingestion and exposing supplemental market inputs in replay timeline/report payload.
- 2026-03-28: Completed `G10-04` by adding deterministic 3-symbol parity harness validating replay decision trace against shared execution core outcomes.
- 2026-03-28: Completed `G10-05` by adding operator-visible parity mismatch diagnostics (`timestamp`, `side`, `trigger`, `mismatchReason`) in backtest report and timeline payloads.
- 2026-03-28: Completed `G10-06` by publishing manual Binance side-by-side parity playbook (`docs/operations/binance-side-by-side-parity-checklist.md`) for 3 symbols and aligned interval/indicator setup.
- 2026-03-28: Completed `G10-07` by adding backtests e2e contract for strategy + 3-symbol market-group + report parity diagnostics + paper pre-trade consistency baseline.
- 2026-03-28: Completed `G10-08` by optimizing markets-tab timeline loading to keep all chart cards visible while preventing eager full-history hydration for every symbol.
- 2026-03-28: Completed `G10-09` by publishing parity mismatch operator runbook (`docs/operations/backtest-parity-mismatch-runbook.md`) with triage and escalation flow.
- 2026-03-28: Completed `G10-10` by hardening parity diagnostics with per-symbol status/error output so failed symbol processing is explicit instead of silent.
- 2026-03-28: Completed `G10-11` by adding parity status/error UI badges per symbol in Markets tab and rendering symbols with no trades for full run transparency.
- 2026-03-28: Completed `G10-12` by fixing reports service API import contract and re-running web TypeScript gate successfully.
- 2026-03-28: Completed `G10-13` by hardening timeline API contract to run-scoped symbols only, with `404` e2e coverage for out-of-scope symbol requests.
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
- 2026-03-19: Extended pre-trade decision trace for spot rollout by persisting bot `marketType` in critical live-path audit metadata.
- 2026-03-19: Extended risk-first confirmations by requiring operator confirmation before deleting active/LIVE bot configurations.
- 2026-03-19: Reduced client lint noise by fixing missing `router` hook dependencies in auth and dashboard navigation guards.
- 2026-03-19: Reduced remaining client lint/typecheck warnings by cleaning profile hooks and fixing backtest form resolver/type wiring.
- 2026-03-19: Improved frontend production hygiene by migrating shared header logos to `next/image` and reducing remaining lint warnings.
- 2026-03-19: Finalized client build-warning cleanup by migrating profile avatar preview to `next/image` with dynamic-source-safe loader settings.
- 2026-03-19: Completed risk-first live-action confirmations by adding explicit API-key deletion risk acknowledgment and bot-deletion live guards with client regression coverage.
- 2026-03-19: Aligned public-facing app metadata and landing copy with spot+futures scope to avoid futures-only messaging during V1 rollout.
- 2026-03-19: Extended bots API with optional `marketType` list filter to support spot/futures operational split in dashboard and automation workflows.
- 2026-03-19: Wired dashboard bot filter controls to backend `marketType` query for server-sourced SPOT/FUTURES segmentation.
- 2026-03-19: Added go-live infra helper scripts (`go-live:infra:up/down`, `test:go-live:server:with-infra`) and documented them in smoke-pack instructions.
- 2026-03-19: Started hedge-mode delivery by introducing bot-level `positionMode` (`ONE_WAY`/`HEDGE`) in schema/API contracts as execution groundwork.
- 2026-03-19: Completed hedge-mode backend support by enforcing futures `positionSide` for HEDGE orders in connector flow and persisting `positionMode` in pre-trade audit metadata.
- 2026-03-19: Extended hedge-mode rollout to dashboard bot UX by adding `positionMode` create/edit controls with updated client regression tests.
- 2026-03-19: Completed spot trading support in live connector contract by validating SPOT order payloads and rejecting futures-only params (`reduceOnly`, hedge `positionSide`) with regression tests.
- 2026-03-19: Added robust smoke-pack orchestrator (`scripts/goLiveSmoke.mjs`) with auto infra up/down lifecycle; full smoke remains blocked locally until Docker Desktop engine is running.
- 2026-03-19: Added advanced pre-trade risk limits for daily loss, drawdown, and consecutive losses with deterministic risk-evaluator test coverage.
- 2026-03-19: Added pre-trade cooldown policy support after losses with configurable cooldown window (`lastLossAtEpochMs` + `cooldownAfterLossMinutes`) and regression tests.
- 2026-03-19: Added market-data service support for additional sources (`order book`, `funding rate`, `open interest`) with optional provider contract and explicit availability errors.
- 2026-03-19: Completed full go-live smoke pack in live-safe mode via orchestrator (infra up, migrations deploy, server smoke, client smoke, infra down) with all suites green.
- 2026-03-21: Re-verified V1 RC build/test gates (server build, client build, critical server auth+exchange+health+metrics/alerts tests, and critical client logs+bots+shell tests) and recorded fresh checklist evidence.
- 2026-03-21: Marked RC runtime endpoint gates as verified from current automated coverage (`/health`, `/ready`, `/metrics`, `/alerts`, `/workers/health`, `/workers/ready`).
- 2026-03-21: Verified RC security/risk gates with focused suites (JWT rotation, API-key lifecycle, pre-trade kill-switch/emergency controls, LIVE confirmations) and refreshed ownership-audit reference.
- 2026-03-21: Verified RC data/migration gates for current environment (`prisma migrate deploy` no pending migrations; orders/logs/pagination representative tests green). Backup snapshot/restore validation remains pending for target production environment.
- 2026-03-21: Reviewed V1 documentation/communication gates (user guide, operator handbook, localization/accessibility QA docs, changelog, migration notes) and marked RC docs gate as complete.
- 2026-03-21: Added explicit "Outstanding External Gates" list in RC checklist to track remaining production-only evidence and release sign-off dependencies.
- 2026-03-21: Added `v1-rc-external-gates-runbook.md` with step-by-step evidence templates for backup/restore, queue-lag baseline review, incident-contact confirmation, and formal RC sign-offs.
- 2026-03-21: Added `v1-rc-signoff-record.md` template and linked it from RC checklist to standardize Engineering/Product/Operations approvals and RC-owner assignment evidence.
- 2026-03-21: Added `v1-slo-catalog.md` defining MVP/V1 SLO targets and exact source metrics for availability, error budget, latency, worker readiness, queue lag, and live order stability.
- 2026-03-21: Executed production-like load baseline and published threshold evidence in `docs/operations/v1-load-baseline-2026-03-21.md` (error rate `0`, throughput `1345.57 req/s`, p95 `37ms`, p99 `72ms`).
- 2026-03-21: Published final auth/ownership/key-flow verification report in `docs/security/security-audit-verification-2026-03-21.md` (focused regression suite `9` files, `34` tests, all green).
- 2026-03-21: Compiled V1 launch evidence pack (`docs/operations/v1-launch-evidence-pack.md`) linking public docs, operator docs, security artifacts, runtime/load evidence, and remaining production-dependent gates.
- 2026-03-21: Added local cutover checklist (`docs/operations/v1-local-cutover-checklist.md`) for controlled migration from legacy bot runtime to new runtime stack.
- 2026-03-21: Added local rollback checklist (`docs/operations/v1-local-rollback-checklist.md`) for controlled recovery back to legacy runtime during cutover incidents.
- 2026-03-21: Executed local replacement dry-run (`docs/operations/v1-local-cutover-dry-run-2026-03-21.md`) covering strategy/backtest/bot/live-guardrail/runtime-flow scenarios with all selected suites green.
- 2026-03-21: Completed launch review and V1.1 backlog cut in `docs/operations/v1-launch-review-2026-03-21.md` using compiled launch evidence and current external-gate status.

- 2026-03-21: Added explicit Exit Evidence Workpack to operationalize remaining V1 production criteria.
- 2026-03-22: Expanded post-V1 Phase G with header/routing normalization, auth session hardening, temporary isometric-toggle removal, and `web/api/mobile` repo-structure planning tasks.
- 2026-03-22: Synced Phase G completion state for delivered nav/header/language/routing/isometric-menu cleanup tasks with repository commits and MVP planning queue.
- 2026-03-22: Added audit-closure gates (truthful docs status, core test green gate, LIVE side-effects contract, stream-contract completion, and ops endpoint access control) and locked admin/billing scope to post-MVP/V1.1.
- 2026-03-22: Realigned roadmap/product/user-guide wording to remove implied V1 admin+billing delivery claims and keep those capabilities explicitly in post-MVP/V1.1 planning scope.
- 2026-03-22: Completed stream SSE contract hardening in API route (monotonic event ids, ping heartbeat comments, periodic health events, and symbol-limit query guard) with dedicated tests.
- 2026-03-22: Applied routing hard-cut by removing legacy dashboard alias pages and keeping canonical route map/menu active-state behavior aligned to canonical URLs only.
- 2026-03-22: Closed i18n contract gap by enforcing EN SSR default lang and migrating dashboard-home live widget copy into translation dictionaries.
- 2026-03-22: Secured ops surface by enforcing auth + ADMIN role + private-network guardrails on `/metrics`, `/alerts`, and `/workers/*`, with updated endpoint contract tests.
- 2026-03-22: Migrated rate-limit identity strategy to user/exchange-aware scopes and bound auth/api-key routes to scoped keys, reducing shared-IP cross-user throttling collisions.
- 2026-03-22: Hardened auth session recovery (`/auth/me` + `requireAuth`) to clear invalid/deleted-user cookies deterministically and return 503 on temporary auth DB unavailability.
- 2026-03-22: Added login/register password visibility controls with explicit screen-reader labels and regression tests for show/hide toggle behavior.
- 2026-03-22: Completed docs/navigation cleanup for `Bots/Exchanges`, defined staged `client/server -> web/api` migration plan, and added bootstrap-only `apps/mobile` scaffold contract.
- 2026-03-23: Implemented live exchange reconciliation loop (`G3`) using `syncExternalPositions/manageExternalPositions` API-key flags with exchange-source upsert/close projection for `EXCHANGE_SYNC` positions.
- 2026-03-23: Extracted shared execution core helpers/decision model (`G4` step 1) and wired runtime orchestrator + paper lifecycle to reuse deterministic side/action mapping.
- 2026-03-23: Completed shared-core routing/parity (`G4` step 2/3) by running runtime signal + position automation through orchestrator/shared decision core and adding adapter parity tests for PAPER/LIVE + paper entry-side mapping.
- 2026-03-23: Upgraded paper fill semantics (`G5` step 1) with entry latency ticks + partial fills per tick in lifecycle flow while preserving fee/slippage/funding trade simulation outputs.
- 2026-03-23: Completed runtime analytics persistence (`G5` step 2) by recording runtime execution events and creating trade records on open/close orchestration paths for PAPER/LIVE parity traces.
- 2026-03-23: Added paper/live decision-equivalence scenario tests (`G5` step 3) validating identical runtime outcomes for shared signal sequences with adapter-specific execution differences abstracted.
- 2026-03-23: Replaced heuristic backtest trade generator with shared-core replay simulation (`G6` step 1) and added dedicated replay-core tests for no-flip/liquidation behavior.
- 2026-03-23: Extended backtest lifecycle trace toward `G6` step 2 by persisting trade exit metadata (`exitReason`, `liquidated`) and exposing `LIQUIDATION` events in timeline payloads.
- 2026-03-23: Added historical candle DB cache with incremental write-back (`G6` step 3) using `MarketCandleCache` and safe fallback to direct Binance fetch for deterministic backtest replay windows.
- 2026-03-23: Completed `G6` step 2 by extending replay lifecycle events (`ENTRY/EXIT/DCA/TP/SL/TRAILING/LIQUIDATION`), wiring timeline to replay events, and persisting lifecycle event counters into report metrics.
- 2026-03-24: Closed `G7 feat(positions)` as delivered in dashboard Positions board (source + management badges and management toggle action), re-verified via `PositionsBoard` component test suite.
- 2026-03-24: Delivered `G7 feat(metrics)` cross-mode comparison (`BACKTEST/PAPER/LIVE`) via new API endpoint `/dashboard/reports/cross-mode-performance` and dashboard Reports section with dedicated regression tests.
- 2026-03-24: Added and executed `G7 test(e2e)` parity+reconciliation scenario in `backtests.e2e.test.ts` (strategy -> backtest -> reconcile exchange positions -> paper/live parity assertions); suite passes with local Docker PostgreSQL runtime.
- 2026-03-24: Added `ops:slo:collect` evidence collector script (`scripts/collectSloEvidence.mjs`) with JSON+Markdown artifacts to accelerate production SLO observation window and queue-lag gate closure.
- 2026-03-24: Added `ops:rc:gates:status` helper (`scripts/buildRcExternalGateStatus.mjs`) to convert latest SLO artifact into RC external-gates status snapshot (queue-lag/probe/reliability derived PASS/OPEN hints plus manual follow-up checklist).
- 2026-03-24: Added external-gates quick commands section to RC checklist with canonical collector/status-builder commands and artifact output paths for faster release sign-off execution.
- 2026-03-24: Enhanced `ops:rc:gates:status` with `--template-only` bootstrap mode to generate RC external-gates status file even before first telemetry artifact is collected.
- 2026-03-24: Bootstrapped baseline `docs/operations/v1-rc-external-gates-status.md` from template mode to provide a canonical handoff file for manual gate evidence and sign-off updates.
- 2026-03-24: Added `ops:db:backup-restore:check-local` helper (`scripts/verifyLocalBackupRestore.mjs`) for Gate 1 dry-run validation (pg_dump -> isolated restore DB -> key table count checks -> cleanup), verified on local Docker Postgres runtime.
- 2026-03-24: Added `ops:rc:gates:local-pipeline` orchestrator (`scripts/runLocalExternalGatesPipeline.mjs`) to execute local external-gates flow in one command (DB check + SLO collection + status snapshot).
- 2026-03-24: Hardened local external-gates pipeline with API health preflight and `--allow-offline` fallback that produces template status output when runtime telemetry endpoint is unavailable.
- 2026-03-24: Added rolling SLO summary command (`ops:slo:window-report`) generating 7d/30d aggregate snapshots and queue-lag breach timelines from collected SLO artifacts.
- 2026-03-24: Added RC sign-off automation command (`ops:rc:signoff:build`) that generates `v1-rc-signoff-record.md` from gate status and named approver inputs.
- 2026-03-24: Added one-command cutover dry-run command (`ops:cutover:dry-run`) with structured JSON+Markdown artifacts for repeatable local migration evidence.
- 2026-03-24: Fixed cross-suite API test cleanup order for new assistant config relations (`BotSubagentConfig`/`BotAssistantConfig`), eliminating FK cleanup regressions during e2e verification runs.
- 2026-03-25: Unblocked cutover-critical e2e tests by fixing strategy-link reorder route precedence and updating runtime-flow e2e to use/cleanup `BotMarketGroup` model correctly.
- 2026-03-25: Re-ran local backup/restore validation via `ops:db:backup-restore:check-local` and linked timestamped evidence artifacts in RC checklist latest verification notes.

