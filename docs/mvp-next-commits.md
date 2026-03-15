# MVP Next Commits Queue

Operational queue for one-task execution runs.

## Start Intent
- User sends any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`).
- Agent executes exactly one unchecked task from `NOW`.

## NOW
- [ ] `feat(ui): dashboard/reports performance views`
- [ ] `feat(ui): dashboard/logs audit trail`
- [ ] `feat(ui): dashboard/exchanges api-key connections`
- [ ] `feat(i18n): EN default + PL translation coverage`
- [ ] `feat(i18n): enforce translation-key usage (no hardcoded page copy) and feature-based namespaces`

## NEXT
- [ ] `feat(i18n): locale-aware date/number/currency/percent formatting for dashboard data views`

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

## Queue Rules
- Keep `NOW` at max 5 tasks.
- Keep one logical change per task.
- If task grows, split before coding.
- After completion, update this file and `docs/mvp-execution-plan.md`.
