# MVP Execution Plan (Agent-Ready)

Goal: deliver a stable MVP in tiny, safe commits.
Rule: fix/cleanup/update first, then feature delivery.

## Plan Governance
- This file is the source of truth for MVP execution.
- `docs/mvp-next-commits.md` is the short operational queue (`NOW` max 5).
- After each merged task: update checkbox + add one line in `Progress Log`.
- If product docs scope changes, update this file before coding.
- Any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`) means: execute exactly one task from `NOW`.

## Global Commit Rules
- One commit = one logical change (typically 1-3 files).
- Commit format: `type(scope): short description`.
- Preferred order: `fix` / `refactor` / `test` / `chore` before `feat`.
- No mixed commits (for example feature + refactor together).

## Phase 0 - Stabilization and Baseline (Must Finish First)
- [x] `chore(repo): add root workspace scripts for lint/typecheck/test/build`
- [x] `chore(ci): add minimal CI checks for client and server`
- [x] `docs(decisions): freeze MVP strategy schema shape (entry/exit/risk/filters/timeframes)`
- [x] `docs(decisions): resolve preset storage approach for MVP`
- [x] `refactor(api): unify API error response payload`
- [x] `refactor(validation): centralize zod error formatting`
- [x] `fix(server): reduce critical any usage in auth/middleware`
- [x] `fix(client): reduce critical any usage in strategy/profile flows`
- [x] `test(auth): stabilize deterministic auth regression tests`
- [x] `test(strategies): add strategy CRUD contract tests`
- [x] `security(api-keys): verify encrypted-only storage and masked response`
- [x] `security(rate-limit): add limiter for auth, market, and trading endpoints`
- [x] `docs(cleanup): normalize encoding and Current/Planned consistency`

## Phase 1 - Data Model and Core API (MVP Foundation)
- [x] `feat(db): add MarketUniverse model`
- [x] `feat(db): add SymbolGroup model`
- [x] `feat(db): add Bot and BotStrategy models`
- [x] `feat(db): add Position, Order, Trade, Signal models`
- [x] `feat(db): add BacktestRun, BacktestTrade, BacktestReport models`
- [x] `feat(db): add Log model for audit trail`
- [x] `feat(api): markets module CRUD (filters, whitelist/blacklist, auto-exclude rules)`
- [x] `feat(api): bots module CRUD (execution mode, opt-in flags, limits)`
- [x] `feat(api): orders and positions read endpoints`
- [x] `feat(api): ownership checks for all new entities`
- [x] `test(api): add data isolation tests for markets/bots/orders/positions/backtests`

## Phase 2 - Trading Engine Core (Backtest-First)
- [x] `feat(engine): market-data ingestion service (OHLCV) with caching`
- [x] `feat(engine): indicator calculation adapter`
- [x] `feat(engine): rule evaluator (AND/OR + comparisons + multi-timeframe)`
- [x] `feat(engine): pre-trade analysis and position limit checks`
- [x] `feat(engine): simulator with fees/slippage/funding`
- [x] `feat(engine): order types market/limit/stop/stop-limit/take-profit/trailing`
- [x] `feat(engine): TP/SL/trailing/DCA position management`
- [x] `feat(api): backtest run/create/list endpoints`
- [x] `feat(api): backtest trade list and report endpoints`
- [x] `test(engine): deterministic simulator tests for pnl/fees/funding`

## Phase 3 - Paper and Live Futures (MVP Trading Modes)
- [x] `feat(engine): paper runtime loop on live market feed`
- [x] `feat(engine): paper position lifecycle and order simulation parity`
- [x] `feat(exchange): CCXT futures connector scaffold`
- [x] `feat(exchange): live order placement adapter with retries`
- [x] `security(live): explicit live opt-in per bot`
- [x] `security(live): global kill-switch and emergency stop`
- [x] `feat(logs): write audit entries for critical trading decisions`
- [x] `test(e2e): smoke tests for paper/live critical paths`

## Phase 4 - Dashboard Completion (MVP UX Scope)
- [x] `docs(ui): audit legacy CryptoBot dashboard patterns for positions/orders and control-center IA`
- [x] `feat(ui): post-login control-center dashboard with key KPIs, bot status, and quick actions`
- [x] `feat(ui-shell): unify dashboard app shell, page headers, and breadcrumb patterns across modules`
- [ ] `feat(ui-state): implement shared loading/empty/degraded/error/success state components`
- [ ] `feat(ui-tokens): add semantic risk and execution-mode tokens (paper/live/warning/danger) and reusable status badges`
- [ ] `feat(ui-control-center): add sticky safety bar with mode/connectivity/heartbeat and emergency action`
- [ ] `feat(ui-control-center): add risk notice footer with logs drill-down shortcut`
- [ ] `feat(ui): dashboard/markets flow`
- [ ] `feat(ui): dashboard/builder strategy editor + presets`
- [ ] `feat(ui): dashboard/bots management + mode status`
- [ ] `feat(ui): dashboard/orders and dashboard/positions`
- [ ] `feat(ui): dashboard home widgets for live positions/orders snapshot and recent actions feed`
- [ ] `feat(ui): dashboard/backtest full UX + overlays + summary`
- [ ] `feat(ui): dashboard/reports performance views`
- [ ] `feat(ui): dashboard/logs audit trail`
- [ ] `feat(ui): dashboard/exchanges api-key connections`
- [ ] `feat(i18n): EN default + PL translation coverage`
- [ ] `feat(i18n): enforce translation-key usage (no hardcoded page copy) and feature-based namespaces`
- [ ] `feat(i18n): locale-aware date/number/currency/percent formatting for dashboard data views`
- [ ] `feat(ui): responsive pass for desktop/tablet/mobile`
- [ ] `feat(ui): PWA baseline parity for core flows`
- [ ] `feat(a11y): keyboard/focus/semantic heading baseline for core dashboard pages`
- [ ] `test(ui): EN/PL key coverage and responsive smoke tests`
- [ ] `test(ui): view-state consistency tests for loading/empty/degraded/error/success`
- [ ] `test(ux): control-center 10-second operator clarity checklist`

## Phase 5 - MVP Closure and Release Readiness
- [ ] `docs(ops): MVP runbook for deployment and recovery`
- [ ] `docs(risk): user-facing trading risk notice and live consent text`
- [ ] `docs(release): known limits and post-MVP boundaries`
- [ ] `chore(release): MVP release checklist and changelog`

## MVP Exit Criteria
- [x] Phase 0 fully complete.
- [ ] End-to-end flow works: strategy -> backtest -> paper -> live opt-in.
- [ ] Security guardrails active: encryption, ownership checks, rate limits, audit logs.
- [ ] Core tests passing for auth, strategy CRUD, market/bot isolation, and trading critical paths.
- [ ] UI scope complete for markets, builder, bots, orders, positions, backtest, reports, logs, exchanges.
- [ ] EN/PL and responsive/PWA baseline complete for core flows.
- [ ] Shared app shell and view-state model are consistent across core dashboard modules.

## Progress Log
- 2026-03-15: Initialized MVP execution file and commit rules.
- 2026-03-15: Added generic trigger-based one-task execution workflow.
- 2026-03-15: Expanded MVP plan to fully align with product, modules, database, trading, testing, and security docs.
- 2026-03-15: Added root workspace scripts for lint/typecheck/test/build in package.json.
- 2026-03-15: Added minimal GitHub Actions CI checks for client and server.
- 2026-03-15: Frozen MVP strategy schema shape in open-decisions and product docs.
- 2026-03-15: Unified API error response payload format across middleware and core modules.
- 2026-03-15: Stabilized auth regression tests with deterministic DB cleanup and test-safe app startup.
- 2026-03-15: Resolved MVP preset storage approach as code-defined templates in docs.
- 2026-03-15: Centralized Zod validation error formatting via shared helper.
- 2026-03-15: Reduced critical any usage in auth/middleware via typed request user context.
- 2026-03-15: Reduced critical any usage in strategy/profile client flows with typed payloads and DTO mapping.
- 2026-03-15: Added strategies CRUD contract e2e tests with auth and ownership isolation checks.
- 2026-03-15: Added dashboard planning tasks for post-login control center and positions/orders-first home widgets.
- 2026-03-15: Verified API keys are encrypted at rest and masked in API responses with security e2e coverage.
- 2026-03-15: Added in-memory rate limiting for auth, market, and trading endpoints.
- 2026-03-15: Normalized docs consistency rules for Current/Planned sections and UTF-8 encoding.
- 2026-03-15: Audited legacy dashboard patterns and defined control-center IA priorities for positions/orders-first home.
- 2026-03-15: Implemented post-login control-center dashboard with KPI, positions/orders snapshots, quick actions, and activity feed seed widgets.
- 2026-03-15: Added MarketUniverse Prisma model with ownership relation, universe filters, whitelist/blacklist, and migration SQL.
- 2026-03-15: Added SymbolGroup Prisma model linked to MarketUniverse and User with symbol list storage and migration SQL.
- 2026-03-15: Added Bot and BotStrategy Prisma models with execution mode, live opt-in flag, position limit, and strategy-to-group mapping migration.
- 2026-03-15: Added Position, Order, Trade, and Signal Prisma models with trading enums, ownership relations, and one-open-position-per-symbol index.
- 2026-03-15: Added BacktestRun, BacktestTrade, and BacktestReport Prisma models with status lifecycle, run-level trade mapping, and one-to-one report relation.
- 2026-03-15: Added Log Prisma model for audit trail with severity, source, actor, metadata, and ownership relations.
- 2026-03-15: Added markets API CRUD for market universes with validation, ownership checks, and e2e contract coverage.
- 2026-03-15: Added bots API CRUD with execution mode, live opt-in, position limits, ownership checks, and e2e coverage.
- 2026-03-15: Added read-only orders and positions API endpoints with query filters, ownership checks, and e2e coverage.
- 2026-03-15: Standardized ownership behavior to return 404 on foreign resources for strategy and api-key update/delete paths.
- 2026-03-15: Added cross-module data isolation e2e coverage for markets, bots, orders, positions, and backtest datasets.
- 2026-03-15: Added market-data OHLCV ingestion service with in-memory TTL caching and unit coverage for cache hit, expiry, and force refresh.
- 2026-03-15: Added indicator calculation adapter for SMA, EMA, and RSI with unit coverage for warmup and output ranges.
- 2026-03-15: Added rule evaluator service for AND/OR comparison rules with multi-timeframe indicator snapshot support.
- 2026-03-15: Added pre-trade analysis service with live opt-in enforcement and user/bot/symbol open-position limit checks.
- 2026-03-15: Added deterministic trade simulator with fee, slippage, and funding cost accounting plus unit coverage.
- 2026-03-15: Added order type evaluator for market, limit, stop, stop-limit, take-profit, and trailing with stateful trigger handling.
- 2026-03-15: Added position management engine for TP/SL/trailing stop and DCA with deterministic state transitions.
- 2026-03-15: Added backtests API endpoints for run create/list/get with ownership checks and strategy ownership validation.
- 2026-03-15: Added backtests API endpoints for run trades list and run report read with ownership isolation and e2e coverage.
- 2026-03-15: Expanded simulator unit coverage for deterministic repeats, accounting identity, and explicit slippage cost regression cases.
- 2026-03-15: Added paper runtime service loop for polling live market feed with stop control and per-symbol non-overlapping tick execution.
- 2026-03-15: Added paper lifecycle orchestrator for order execution parity, position management (DCA/TP/SL/trailing), and deterministic simulated close-out PnL.
- 2026-03-15: Added CCXT futures connector scaffold with lazy client init, sandbox support, mark-price fetch, and normalized futures order placement contract.
- 2026-03-15: Added live order adapter with retry/backoff policy for retryable exchange failures and deterministic unit coverage.
- 2026-03-15: Enforced explicit live opt-in per bot in pre-trade checks by validating bot ownership, LIVE mode, and liveOptIn flag from store data.
- 2026-03-15: Added live pre-trade kill controls via global kill-switch and emergency-stop guards with deterministic test coverage.
- 2026-03-15: Added audit log writes for critical pre-trade decisions (allowed/blocked in LIVE and blocked decisions) with non-blocking failure handling.
- 2026-03-15: Synced MVP UX tasks with new `ui-ux-foundation.md` baseline (shell, states, tokens, control-center safety patterns, i18n, accessibility).
- 2026-03-15: Unified dashboard shell spacing and page-header/breadcrumb patterns across control center, strategies, backtest, and profile views.
- 2026-03-15: Added pre-trade smoke e2e coverage for critical paper/live paths, including live allow, kill-switch block, and audit-log assertions.
