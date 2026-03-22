# MVP Next Commits Queue

Operational queue for one-task execution runs.

## Start Intent
- User sends any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`).
- Agent executes exactly one unchecked task from `NOW`.

## NOW
- [ ] `fix(auth-session-recovery): enforce automatic logout on invalid session/user-deleted scenarios and add graceful no-db fallback behavior`
- [ ] `feat(auth-password-visibility): add password visibility toggle in login/register forms with a11y labels and tests`

## NEXT
- [ ] `fix(ui-profile): remove isometric toggle from account menu and defer feature to V2 gamification`
- [ ] `docs(repo-structure): define target monorepo apps naming (`apps/web`, `apps/api`, `apps/mobile`) and migration rollout sequence`
- [ ] `chore(repo-migration-plan): prepare non-breaking rename plan from client/server to web/api (scripts, CI, env, docs)`
- [ ] `docs(mobile-bootstrap): define mobile app bootstrap plan (React Native/Expo), API parity scope, and auth/session contract`

## BLOCKED
- [ ] `exit-gates(v1-production): production SLO observation window + target-env backup/restore + queue-lag telemetry review + formal release sign-offs`

## DONE
- [x] `chore(planning): initialize MVP/V1 execution plans and agent blueprint`
- [x] `chore(planning): align trigger intent to generic one-task nudge`
- [x] `chore(planning): historical done backlog archived in git history; queue reset for current delivery focus`
- [x] `docs(sync): reconcile roadmap immediate gaps with implemented runtime-stream status and evidence links`
- [x] `ops(slo): define MVP/V1 SLO set and add measurable targets + source metrics`
- [x] `ops(evidence): run production-like load baseline and attach results to v1 exit criteria`
- [x] `security(audit): run ownership/auth/key-flow verification pass and publish evidence summary`
- [x] `release(evidence): compile public docs pack and launch-readiness evidence checklist`
- [x] `ops(cutover): define local cutover checklist from legacy bot to new runtime`
- [x] `ops(cutover): define rollback checklist to legacy runtime`
- [x] `test(cutover): execute local replacement dry-run with realistic bot scenario`
- [x] `release(review): run 7-day launch retrospective and cut V1.1 backlog`
- [x] `docs(sync): normalize planning files so roadmap/mvp/v1 statuses are fully consistent`
- [x] `fix(auth-build): resolve client build blockers in login/auth files (eslint apostrophe + hooks deps) so pnpm --filter client build is green`
- [x] `fix(auth-ux): validate and harden failed-login error UX (inline + toast) without false positive success styling`
- [x] `fix(auth-session-warning): remove false session-expired warnings on public routes and keep warning only for protected/session-expired contexts`
- [x] `test(auth-client): add/adjust regression tests for failed login, successful login, and post-login redirect behavior`
- [x] `qa(auth-smoke): run manual auth smoke (fail login, success login, logout redirect, protected route redirect) and capture evidence`
- [x] `fix(ui-api-key-test): replace random result in ApiKeyForm with real request state machine (idle/loading/success/error)`
- [x] `feat(api-key-test-api): add POST /dashboard/profile/apiKeys/test route (auth + validation + no persistence)`
- [x] `security(api-key-test): add rate-limit + audit-safe logging for test endpoint`
- [x] `feat(api-key-test-binance): implement Binance permission probe and normalized error mapping contract`
- [x] `test(api-key-test): add server e2e for invalid credentials, permission mismatch, and success path`
- [x] `feat(profile-save-flow): block LIVE-ready key save until connection test success in current form session`
- [x] `feat(positions-sync-api): add endpoint to fetch current open positions from Binance using verified stored credentials`
- [x] `feat(ui-positions-live-source): add live-exchange snapshot mode with last-sync + error state`
- [x] `test(positions-live-source): add e2e/ui coverage for snapshot fetch and failure handling`
- [x] `docs(runbook): add API-key onboarding + Binance permission troubleshooting guide`
- [x] `feat(ui-nav): rename Execution to Bots and move Orders/Positions into Exchanges dropdown between Dashboard and Markets`
- [x] `feat(db): add position/order/trade origin + management mode fields with migration baseline`
- [x] `feat(api-key-onboarding): add sync_external_positions and manage_external_positions options`
- [x] `feat(runtime-guard): enforce no-flip and manual-managed symbol ignore rules in runtime execution flow`
- [x] `feat(positions-ui): show position source and management mode badges plus explicit toggle action`
- [x] `fix(ui-header-nav): center desktop nav list, simplify menu utility classes, and unify hover/active/focus color states across header controls`
- [x] `fix(ui-language-switcher): replace incorrect EN flag styling and add visual regression coverage for locale switcher`
- [x] `audit(routing-dashboard): produce canonical route map and remove dashboard path inconsistencies (backtest/backtests, list/create aliases, menu contracts)`
- [x] `refactor(profile-ia): merge API keys + exchange connections into one user-settings information architecture`
- [x] `fix(profile-menu): remove isometric toggle from account menu (deferred to V2 gamification track)`
- [x] `docs(sync-audit): correct plan truthfulness (core-tests status, done/pending mismatches, duplicate checkbox states) against current repo state`
- [x] `test(quality-gate): restore green core suites (including i18n provider and auth/requireAuth rotation regressions) and attach evidence`
- [x] `docs(scope): realign admin+billing from V1 implementation scope to post-MVP/V1.1 delivery track`
- [x] `feat(stream-contract): implement transport contract gaps (event id, heartbeat/ping, symbol-limit guard) for dashboard market stream`
- [x] `fix(routing-hard-cut): enforce canonical dashboard routes with hard-cut policy (remove backtest/backtests ambiguity and update menu links/tests)`
- [x] `fix(i18n-contract): remove remaining hardcoded copy and align default locale contract (docs vs SSR html lang)`
- [x] `fix(live-execution-contract): align LIVE path to real exchange side effects; keep simulation strictly in PAPER/BACKTEST`
- [x] `security(ops-endpoints): restrict /metrics, /alerts, /workers/* access with auth/role/network guardrails`
- [x] `refactor(rate-limit): move from IP-centric throttling toward user/exchange-key aware limits`

## Queue Rules
- Keep `NOW` at max 5 tasks.
- Keep one logical change per task.
- If task grows, split before coding.
- After completion, update this file and `docs/planning/mvp-execution-plan.md`.
