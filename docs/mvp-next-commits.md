# MVP Next Commits Queue

Operational queue for one-task execution runs.

## Start Intent
- User sends any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`).
- Agent executes exactly one unchecked task from `NOW`.

## NOW
- [ ] `feat(engine): paper runtime loop on live market feed`
- [ ] `feat(engine): paper position lifecycle and order simulation parity`
- [ ] `feat(exchange): CCXT futures connector scaffold`
- [ ] `feat(exchange): live order placement adapter with retries`
- [ ] `security(live): explicit live opt-in per bot`

## NEXT
- [ ] `security(live): global kill-switch and emergency stop`
- [ ] `feat(logs): write audit entries for critical trading decisions`
- [ ] `test(e2e): smoke tests for paper/live critical paths`

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

## Queue Rules
- Keep `NOW` at max 5 tasks.
- Keep one logical change per task.
- If task grows, split before coding.
- After completion, update this file and `docs/mvp-execution-plan.md`.
