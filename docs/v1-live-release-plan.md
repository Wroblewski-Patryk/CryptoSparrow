# V1.0 Official Live Plan (World-Ready)

Goal: move from MVP to a production-grade public release (V1.0).
This plan extends docs scope: reliability, safety, observability, and scale.

## Update Protocol
- Keep this file as V1.0 source of truth.
- Any new requirement goes first to docs, then to this plan.
- Progress should be tracked with tiny commits and short notes.

## Release Standard (Definition of V1.0)
- Stable public live trading with explicit risk controls.
- Strong observability (logs, metrics, alerts) and incident runbooks.
- Reproducible deployments and rollback strategy.
- Clear product docs and user-facing risk communication.

## Phase A - Hardening After MVP
- [ ] `fix(core): remove high-risk tech debt from trading paths`
- [ ] `refactor(engine): isolate signal/execution/risk boundaries`
- [ ] `security(auth): session/JWT hardening and rotation policy`
- [ ] `security(keys): key lifecycle policy (create/rotate/revoke)`
- [ ] `test(regression): expand regression suite for critical flows`
- [ ] `docs(security): final MVP-to-v1 threat model update`

## Phase B - Reliability + Operations
- [ ] `feat(obs): structured logging across api/worker/execution`
- [ ] `feat(obs): metrics for latency, error rate, queue lag`
- [ ] `feat(obs): alert rules for failed orders and stale market data`
- [ ] `feat(ops): health/readiness endpoints for api and workers`
- [ ] `feat(ops): worker separation for market/backtest/execution`
- [ ] `chore(ops): deployment runbook + rollback checklist`

## Phase C - Scale + Performance
- [ ] `perf(cache): optimize Redis caching strategy for market and dashboard`
- [ ] `perf(queue): optimize BullMQ job model for data/signal/execution`
- [ ] `perf(db): indexes and query tuning for orders/positions/backtests`
- [ ] `perf(api): pagination and filtering standards for large datasets`
- [ ] `test(load): baseline load tests for api and worker throughput`

## Phase D - Product Scope to V1.0
- [ ] `feat(trading): spot trading support`
- [ ] `feat(strategy): import/export JSON with format versioning`
- [ ] `feat(trading): hedge mode support`
- [ ] `feat(risk): advanced limits (daily loss/drawdown/consecutive loss)`
- [ ] `feat(risk): cooldown policies after losses`
- [ ] `feat(data): additional sources (order book/funding/open interest)`

## Phase E - UX + Trust for Public Launch
- [ ] `feat(ui): risk-first confirmations for all live actions`
- [ ] `feat(ui): audit/log explorer with decision trace`
- [ ] `feat(i18n): complete EN/PL parity`
- [ ] `feat(accessibility): core dashboard accessibility pass`
- [ ] `docs(user): onboarding, safety guide, and FAQ`

## Phase F - Go-Live Execution
- [ ] `chore(release): release candidate checklist`
- [ ] `chore(release): freeze window and bug bash`
- [ ] `test(e2e): full go-live smoke pack`
- [ ] `chore(release): v1.0 tag + changelog + migration notes`
- [ ] `chore(release): post-release monitoring and hotfix protocol`

## V1.0 Exit Criteria
- [ ] SLOs defined and observed in production.
- [ ] Incident response process tested with drills.
- [ ] Security controls audited for auth, keys, and ownership.
- [ ] Public docs complete for users and operators.
- [ ] Launch retrospective and backlog for V1.1 created.

## Progress Log
- 2026-03-15: Initialized V1.0 live release plan.

