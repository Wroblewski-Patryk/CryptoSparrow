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
- [ ] `fix(core): remove high-risk technical debt in trading-critical paths`
- [ ] `refactor(engine): isolate signal/execution/risk boundaries`
- [ ] `security(auth): JWT/session hardening + rotation policy`
- [ ] `security(keys): API key lifecycle policy (create/rotate/revoke)`
- [ ] `security(access): enforce ownership checks for all sensitive actions`
- [x] `test(regression): expand regression suite for critical flows`
- [x] `docs(security): update threat model and residual risk register`

## Phase B - Reliability, Operations, and Runtime
- [ ] `feat(obs): structured logging across api/worker/exchange layers`
- [ ] `feat(obs): metrics for latency, error rate, queue lag, and order failures`
- [ ] `feat(obs): alert rules for failed orders, stale market data, and worker health`
- [ ] `feat(ops): health/readiness endpoints for api and workers`
- [ ] `feat(ops): split workers for market-data/backtest/execution`
- [ ] `chore(ops): deployment runbook + rollback checklist + incident playbook`
- [ ] `test(drill): run incident simulation drills and document outcomes`

## Phase C - Scale and Performance
- [ ] `perf(cache): production Redis caching strategy for market and dashboard`
- [ ] `perf(queue): BullMQ job model tuning for data/signal/execution`
- [ ] `perf(db): indexes and query tuning for orders/positions/backtests/logs`
- [ ] `perf(api): pagination/filtering standards for large datasets`
- [ ] `test(load): baseline and stress tests for API/worker throughput`

## Phase D - Product Expansion to V1.0 Scope
- [ ] `feat(trading): spot trading support`
- [ ] `feat(strategy): strategy import/export with format versioning`
- [ ] `feat(trading): hedge mode support`
- [ ] `feat(risk): advanced limits (daily loss/drawdown/consecutive losses)`
- [ ] `feat(risk): cooldown policies after losses`
- [ ] `feat(data): additional sources (order book/funding/open interest)`

## Phase E - UX, Trust, and Public Readiness
- [ ] `feat(ui): risk-first confirmations for all live actions`
- [ ] `feat(ui): audit/log explorer with decision trace`
- [ ] `feat(ui-system): harden shared dashboard design system and component documentation`
- [ ] `feat(i18n): complete EN/PL parity and localization QA`
- [ ] `feat(accessibility): full accessibility pass for core dashboard`
- [ ] `feat(ui-theme): optional isometric visual mode for dashboard (late-stage polish, non-blocking)`
- [ ] `docs(user): onboarding, safety guide, FAQ, and troubleshooting`
- [ ] `docs(operator): production operations handbook`

## Phase F - Go-Live Program
- [ ] `chore(release): release candidate checklist`
- [ ] `chore(release): stabilization freeze window and bug bash`
- [ ] `test(e2e): full go-live smoke pack (live-safe)`
- [ ] `chore(release): v1.0 tag + changelog + migration notes`
- [ ] `chore(release): post-release monitoring and hotfix protocol`
- [ ] `chore(release): 7-day launch review and v1.1 backlog cut`

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
