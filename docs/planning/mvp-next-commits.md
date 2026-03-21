# MVP Next Commits Queue

Operational queue for one-task execution runs.

## Start Intent
- User sends any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`).
- Agent executes exactly one unchecked task from `NOW`.

## NOW
- [ ] `test(auth-client): add/adjust regression tests for failed login, successful login, and post-login redirect behavior`
- [ ] `qa(auth-smoke): run manual auth smoke (fail login, success login, logout redirect, protected route redirect) and capture evidence`

## NEXT
- [ ] `fix(ui-api-key-test): replace random result in ApiKeyForm with real request state machine (idle/loading/success/error)`
- [ ] `feat(api-key-test-api): add POST /dashboard/profile/apiKeys/test route (auth + validation + no persistence)`
- [ ] `security(api-key-test): add rate-limit + audit-safe logging for test endpoint`
- [ ] `feat(api-key-test-binance): implement Binance permission probe and normalized error mapping contract`
- [ ] `test(api-key-test): add server e2e for invalid credentials, permission mismatch, and success path`
- [ ] `feat(profile-save-flow): block LIVE-ready key save until connection test success in current form session`
- [ ] `feat(positions-sync-api): add endpoint to fetch current open positions from Binance using verified stored credentials`
- [ ] `feat(ui-positions-live-source): add live-exchange snapshot mode with last-sync + error state`
- [ ] `test(positions-live-source): add e2e/ui coverage for snapshot fetch and failure handling`
- [ ] `docs(runbook): add API-key onboarding + Binance permission troubleshooting guide`

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

## Queue Rules
- Keep `NOW` at max 5 tasks.
- Keep one logical change per task.
- If task grows, split before coding.
- After completion, update this file and `docs/planning/mvp-execution-plan.md`.
