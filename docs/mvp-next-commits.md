# MVP Next Commits Queue

Operational queue for one-task execution runs.

## Start Intent
- User sends any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`).
- Agent executes exactly one unchecked task from `NOW`.

## NOW

## NEXT

## BLOCKED
- [ ] (empty)

## DONE
- [ ] 2026-03-15 `chore(planning): initialize MVP/V1 execution plans and agent blueprint`
- [ ] 2026-03-15 `chore(planning): align trigger intent to generic one-task nudge`
- [x] 2026-03-15 `chore(repo): add root workspace scripts for lint/typecheck/test/build`
- [x] 2026-03-15 `chore(ci): add minimal CI checks for client and server`
- [x] 2026-03-15 `docs(decisions): freeze MVP strategy schema shape in open-decisions/product docs`
- [x] 2026-03-15 `refactor(api): unify API error response payload`
- [x] 2026-03-15 `test(auth): stabilize deterministic auth regression tests`
- [x] 2026-03-15 `docs(decisions): resolve preset storage approach for MVP`
- [x] 2026-03-15 `refactor(validation): centralize zod error formatting`
- [x] 2026-03-15 `fix(server): reduce critical any usage in auth/middleware`
- [x] 2026-03-15 `fix(client): reduce critical any usage in strategy/profile flows`
- [x] 2026-03-15 `test(strategies): add strategy CRUD contract tests`
- [x] 2026-03-15 `security(api-keys): verify encrypted-only storage and masked response`
- [x] 2026-03-15 `security(rate-limit): add limiter for auth, market, and trading endpoints`
- [x] 2026-03-15 `docs(cleanup): normalize encoding and Current/Planned consistency`
- [x] 2026-03-15 `docs(ui): audit legacy CryptoBot dashboard patterns for positions/orders and control-center IA`
- [x] 2026-03-15 `feat(ui): post-login control-center dashboard with positions/orders snapshot widgets`
- [x] 2026-03-15 `feat(db): add MarketUniverse model`
- [x] 2026-03-15 `feat(db): add SymbolGroup model`
- [x] 2026-03-15 `feat(db): add Bot and BotStrategy models`
- [x] 2026-03-15 `feat(db): add Position, Order, Trade, Signal models`
- [x] 2026-03-15 `feat(db): add BacktestRun, BacktestTrade, BacktestReport models`
- [x] 2026-03-15 `feat(db): add Log model for audit trail`
- [x] 2026-03-15 `feat(api): markets module CRUD (filters, whitelist/blacklist, auto-exclude rules)`
- [x] 2026-03-15 `feat(api): bots module CRUD (execution mode, opt-in flags, limits)`
- [x] 2026-03-15 `feat(api): orders and positions read endpoints`
- [x] 2026-03-15 `feat(api): ownership checks for all new entities`
- [x] 2026-03-15 `test(api): add data isolation tests for markets/bots/orders/positions/backtests`
- [x] 2026-03-15 `feat(engine): market-data ingestion service (OHLCV) with caching`
- [x] 2026-03-15 `feat(engine): indicator calculation adapter`
- [x] 2026-03-15 `feat(engine): rule evaluator (AND/OR + comparisons + multi-timeframe)`
- [x] 2026-03-15 `feat(engine): pre-trade analysis and position limit checks`
- [x] 2026-03-15 `feat(engine): simulator with fees/slippage/funding`
- [x] 2026-03-15 `feat(engine): order types market/limit/stop/stop-limit/take-profit/trailing`
- [x] 2026-03-15 `feat(engine): TP/SL/trailing/DCA position management`
- [x] 2026-03-15 `feat(api): backtest run/create/list endpoints`
- [x] 2026-03-15 `feat(api): backtest trade list and report endpoints`
- [x] 2026-03-15 `test(engine): deterministic simulator tests for pnl/fees/funding`
- [x] 2026-03-15 `feat(engine): paper runtime loop on live market feed`
- [x] 2026-03-15 `feat(engine): paper position lifecycle and order simulation parity`
- [x] 2026-03-15 `feat(exchange): CCXT futures connector scaffold`
- [x] 2026-03-15 `feat(exchange): live order placement adapter with retries`
- [x] 2026-03-15 `chore(planning): sync queue with new UI/UX foundation assumptions`
- [x] 2026-03-15 `security(live): explicit live opt-in per bot`
- [x] 2026-03-15 `security(live): global kill-switch and emergency stop`
- [x] 2026-03-15 `feat(logs): write audit entries for critical trading decisions`
- [x] 2026-03-15 `feat(ui-shell): unify dashboard app shell/page header/breadcrumb patterns`
- [x] 2026-03-15 `test(e2e): smoke tests for paper/live critical paths`
- [x] 2026-03-15 `feat(ui-state): shared loading/empty/degraded/error/success components`
- [x] 2026-03-15 `feat(ui-control-center): sticky safety bar with mode/connectivity/heartbeat/emergency action`
- [x] 2026-03-15 `feat(ui-control-center): risk notice footer with logs shortcut`
- [x] 2026-03-15 `feat(ui-tokens): semantic risk and execution-mode tokens + status badges`
- [x] 2026-03-15 `docs(decisions): close MVP rule nesting depth as explicitly out-of-scope`
- [x] 2026-03-15 `feat(ui): dashboard/markets flow`
- [x] 2026-03-15 `feat(ui): dashboard/builder strategy editor + presets`
- [x] 2026-03-15 `feat(ui): dashboard/bots management + mode status`
- [x] 2026-03-16 `feat(ui): dashboard/orders and dashboard/positions`
- [x] 2026-03-16 `feat(ui): dashboard home widgets for live positions/orders snapshot and recent actions feed`
- [x] 2026-03-16 `feat(ui): dashboard/backtest full UX + overlays + summary`
- [x] 2026-03-16 `feat(ui): dashboard/reports performance views`
- [x] 2026-03-16 `feat(ui): dashboard/logs audit trail`
- [x] 2026-03-16 `feat(ui): dashboard/exchanges api-key connections`
- [x] 2026-03-16 `feat(i18n): EN default + PL translation coverage`
- [x] 2026-03-16 `feat(i18n): enforce translation-key usage (no hardcoded page copy) and feature-based namespaces`
- [x] 2026-03-16 `feat(i18n): locale-aware date/number/currency/percent formatting for dashboard data views`
- [x] 2026-03-16 `feat(ui): responsive pass for desktop/tablet/mobile`
- [x] 2026-03-16 `feat(ui): PWA baseline parity for core flows`
- [x] 2026-03-16 `feat(a11y): keyboard/focus/semantic heading baseline for core dashboard pages`
- [x] 2026-03-16 `test(ui): EN/PL key coverage and responsive smoke tests`
- [x] 2026-03-16 `test(ui): view-state consistency tests for loading/empty/degraded/error/success`
- [x] 2026-03-16 `test(ux): control-center 10-second operator clarity checklist`
- [x] 2026-03-16 `docs(ops): MVP runbook for deployment and recovery`
- [x] 2026-03-16 `docs(risk): user-facing trading risk notice and live consent text`
- [x] 2026-03-16 `chore(planning): reprioritize queue to audit remediation gate (P0-P3)`
- [x] 2026-03-16 `security(upload): protect upload endpoint with auth + MIME/size validation + abuse limits`
- [x] 2026-03-16 `security(live-consent): add consentTextVersion end-to-end (schema, DTO, persistence, audit)`
- [x] 2026-03-16 `config(api+client): fix CORS/URL parsing and remove hardcoded localhost baseURL`
- [x] 2026-03-16 `security(crypto): migrate API-key encryption to AEAD + key versioning`
- [x] 2026-03-16 `qa(test-suite): make server+client test suites fully green (including FK-safe cleanup)`
- [x] 2026-03-16 `api(logs): implement /dashboard/logs with actor/source/severity filtering`
- [x] 2026-03-16 `infra(rate-limit): move limiter from in-memory to Redis-backed implementation`
- [x] 2026-03-16 `auth(session): align remember-me behavior with cookie/session TTL`
- [x] 2026-03-16 `contract(auth): remove dead forgot-password client call paths`
- [x] 2026-03-16 `i18n: remove remaining hardcoded strings in logs/dashboard views`
- [x] 2026-03-16 `cleanup(types): remove remaining any from profile routes/controllers`
- [x] 2026-03-16 `docs(release): known limits and post-MVP boundaries`
- [x] 2026-03-16 `chore(release): MVP release checklist and changelog`
- [x] 2026-03-16 `docs(sync): align stale plan checkboxes with delivered implementation state`

## Queue Rules
- Keep `NOW` at max 5 tasks.
- Keep one logical change per task.
- If task grows, split before coding.
- After completion, update this file and `docs/mvp-execution-plan.md`.
