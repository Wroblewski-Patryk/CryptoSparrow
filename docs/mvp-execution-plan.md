# MVP Execution Plan (Agent-Ready)

Goal: deliver a stable MVP with very small, safe commits.
Rule: first fix/cleanup/update, then new features.

## Update Protocol (for this chat)
- This file is the source of truth for MVP progress.
- After each merged commit: mark checkbox + add one-line note in `Progress Log`.
- Keep `NOW` max 5 tasks in `docs/mvp-next-commits.md`.
- If scope changes in docs, update this plan before coding.

## Global Commit Rules
- One commit = one logical change (typically 1-3 files).
- Message format: `type(scope): short description`.
- Preferred order: `fix` / `refactor` / `test` / `chore` -> then `feat`.
- No mixed commits (feature + refactor in one commit).

## Phase 0 - Stabilization (Must Finish First)
- [ ] `chore(repo): add root scripts lint/typecheck/test/build`
- [ ] `chore(ci): add minimal CI checks for client and server`
- [ ] `fix(server): remove critical any usage in auth/middleware`
- [ ] `fix(client): remove critical any usage in strategy/profile flows`
- [ ] `refactor(api): unify error response shape`
- [ ] `refactor(validation): centralize zod error formatting`
- [ ] `test(auth): stabilize auth regression tests`
- [ ] `test(strategies): add API contract tests for strategy CRUD`
- [ ] `security(api-keys): verify encryption and no plaintext response`
- [ ] `security(rate-limit): add rate limiting for auth and trading endpoints`
- [ ] `docs(cleanup): fix encoding and current/planned consistency`

## Phase 1 - MVP Foundation (Data + API)
- [ ] `feat(db): add MarketUniverse model`
- [ ] `feat(db): add SymbolGroup model`
- [ ] `feat(db): add Bot model`
- [ ] `feat(db): add BotStrategy model`
- [ ] `feat(db): add Position model`
- [ ] `feat(db): add Order model`
- [ ] `feat(db): add Signal model`
- [ ] `feat(api): add markets module CRUD`
- [ ] `feat(api): add bots module CRUD`
- [ ] `feat(api): add ownership checks for all new entities`
- [ ] `test(api): add isolation tests for new modules`

## Phase 2 - Backtester MVP
- [ ] `feat(engine): load OHLCV candles for backtests`
- [ ] `feat(engine): indicator calculation adapter`
- [ ] `feat(engine): strategy rule evaluator (AND/OR + comparisons)`
- [ ] `feat(engine): execution simulator with fees/slippage/funding`
- [ ] `feat(engine): support market/limit/stop/stop-limit in simulator`
- [ ] `feat(engine): TP/SL/trailing and max open positions`
- [ ] `feat(api): backtest run endpoint`
- [ ] `feat(api): backtest trades endpoint`
- [ ] `feat(ui): backtest form connected to API`
- [ ] `feat(ui): backtest results (trade list + overlays + summary)`

## Phase 3 - Paper + Live Futures MVP
- [ ] `feat(engine): paper trading runtime loop`
- [ ] `feat(engine): paper position lifecycle management`
- [ ] `feat(exchange): exchange adapter scaffold (CCXT-based)`
- [ ] `feat(exchange): futures order placement adapter`
- [ ] `security(live): explicit opt-in flag per bot`
- [ ] `security(live): add global kill-switch`
- [ ] `feat(ui): bot mode controls (backtest/paper/live)`
- [ ] `test(e2e): smoke tests for paper/live critical paths`

## Phase 4 - MVP Closure
- [ ] `feat(reports): pnl/drawdown/fees/funding metrics`
- [ ] `feat(logs): audit log for critical actions`
- [ ] `feat(ui): strategy presets (trend/mean reversion/breakout)`
- [ ] `feat(ui): multi-timeframe UX polish`
- [ ] `feat(i18n): EN default + PL translations`
- [ ] `feat(ui): responsive pass for dashboard core pages`
- [ ] `docs(release): runbook, risk notice, known limits`
- [ ] `chore(release): mvp tag + changelog`

## MVP Exit Criteria
- [ ] All Phase 0 tasks complete.
- [ ] End-to-end flow works: strategy -> backtest -> paper -> live opt-in.
- [ ] Security guardrails active: ownership checks, encrypted API keys, rate limits.
- [ ] Core tests passing for auth, strategy CRUD, and trading critical paths.
- [ ] Docs reflect current implementation.

## Progress Log
- 2026-03-15: Initialized MVP execution file and commit rules.
