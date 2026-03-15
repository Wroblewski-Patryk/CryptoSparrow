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
- [ ] `feat(db): add Log model for audit trail`
- [ ] `feat(api): markets module CRUD (filters, whitelist/blacklist, auto-exclude rules)`
- [ ] `feat(api): bots module CRUD (execution mode, opt-in flags, limits)`
- [ ] `feat(api): orders and positions read endpoints`
- [ ] `feat(api): ownership checks for all new entities`
- [ ] `test(api): add data isolation tests for markets/bots/orders/positions/backtests`

## Phase 2 - Trading Engine Core (Backtest-First)
- [ ] `feat(engine): market-data ingestion service (OHLCV) with caching`
- [ ] `feat(engine): indicator calculation adapter`
- [ ] `feat(engine): rule evaluator (AND/OR + comparisons + multi-timeframe)`
- [ ] `feat(engine): pre-trade analysis and position limit checks`
- [ ] `feat(engine): simulator with fees/slippage/funding`
- [ ] `feat(engine): order types market/limit/stop/stop-limit/take-profit/trailing`
- [ ] `feat(engine): TP/SL/trailing/DCA position management`
- [ ] `feat(api): backtest run/create/list endpoints`
- [ ] `feat(api): backtest trade list and report endpoints`
- [ ] `test(engine): deterministic simulator tests for pnl/fees/funding`

## Phase 3 - Paper and Live Futures (MVP Trading Modes)
- [ ] `feat(engine): paper runtime loop on live market feed`
- [ ] `feat(engine): paper position lifecycle and order simulation parity`
- [ ] `feat(exchange): CCXT futures connector scaffold`
- [ ] `feat(exchange): live order placement adapter with retries`
- [ ] `security(live): explicit live opt-in per bot`
- [ ] `security(live): global kill-switch and emergency stop`
- [ ] `feat(logs): write audit entries for critical trading decisions`
- [ ] `test(e2e): smoke tests for paper/live critical paths`

## Phase 4 - Dashboard Completion (MVP UX Scope)
- [x] `docs(ui): audit legacy CryptoBot dashboard patterns for positions/orders and control-center IA`
- [x] `feat(ui): post-login control-center dashboard with key KPIs, bot status, and quick actions`
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
- [ ] `feat(ui): responsive pass for desktop/tablet/mobile`
- [ ] `feat(ui): PWA baseline parity for core flows`
- [ ] `test(ui): EN/PL key coverage and responsive smoke tests`

## Phase 5 - MVP Closure and Release Readiness
- [ ] `docs(ops): MVP runbook for deployment and recovery`
- [ ] `docs(risk): user-facing trading risk notice and live consent text`
- [ ] `docs(release): known limits and post-MVP boundaries`
- [ ] `chore(release): MVP release checklist and changelog`

## MVP Exit Criteria
- [ ] Phase 0 fully complete.
- [ ] End-to-end flow works: strategy -> backtest -> paper -> live opt-in.
- [ ] Security guardrails active: encryption, ownership checks, rate limits, audit logs.
- [ ] Core tests passing for auth, strategy CRUD, market/bot isolation, and trading critical paths.
- [ ] UI scope complete for markets, builder, bots, orders, positions, backtest, reports, logs, exchanges.
- [ ] EN/PL and responsive/PWA baseline complete for core flows.

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
