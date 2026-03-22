# MVP Next Commits Queue

Operational queue for one-task execution runs.

## Start Intent
- User sends any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`).
- Agent executes exactly one unchecked task from `NOW`.

## NOW
- [x] `MBA-01 audit(domain): map current Bot/SymbolGroup/BotStrategy contracts and define non-breaking migration path`
- [x] `MBA-02 docs(decisions): lock canonical model user->bot->market-group->strategy and assistant topology (1 main + max 4 subagents)`
- [x] `MBA-03 docs(contract): define deterministic signal merge policy for multi-strategy per market-group (priority, tie-break, no-trade)`
- [x] `MBA-04 feat(db): add BotMarketGroup model with ownership, lifecycle status, and execution ordering`
- [x] `MBA-05 feat(db): add MarketGroupStrategyLink model (many-strategies per market-group) with priority/weight fields`
- [x] `MBA-06 feat(db-migration): backfill existing bot strategies into default market-group for zero-downtime compatibility`
- [x] `MBA-07 feat(api): add market-group CRUD under bots with strict ownership isolation`
- [x] `MBA-08 feat(api): add attach/detach/reorder strategy endpoints per market-group`
- [x] `MBA-09 feat(api): expose bot runtime graph read endpoint (bot->groups->strategies) for UI/runtime parity`
- [x] `MBA-10 refactor(runtime): change evaluation loop from bot-level flat strategies to bot->market-group partitions`
- [x] `MBA-11 feat(runtime): execute multi-strategy per market-group with locked merge policy and no-flip guarantees`
- [x] `MBA-12 feat(risk): enforce per-market-group risk budget while preserving bot/global hard caps`
- [x] `MBA-13 test(e2e): add full flow for one user with 2 bots, each with multiple market-groups and strategies`
- [x] `MBA-14 docs(ai-contract): define assistant responsibilities, I/O schema, timeout policy, and fail-closed behavior`
- [x] `MBA-15 feat(db): add BotAssistantConfig (main agent mandate, model profile, safety mode)`
- [x] `MBA-16 feat(db): add BotSubagentConfig with slotIndex(1..4), role, enabled flag, and unique(botId,slotIndex)`
- [x] `MBA-17 feat(api): add assistant config CRUD endpoints with hard max-4 subagent validation`
- [x] `MBA-18 feat(runtime-ai): implement main-agent orchestrator scaffold (request plan -> subagent fan-out -> merge)`
- [x] `MBA-19 feat(runtime-ai): implement subagent dispatcher with per-slot timeout, partial-failure tolerance, and deterministic merge`
- [x] `MBA-20 security(ai): add prompt/response sanitization and audit-safe logging for assistant traces`
- [x] `MBA-21 feat(ui): add bot Assistant tab (main agent panel + 4 subagent slots with enable/disable and role)`
- [x] `MBA-22 test(e2e): configure assistant stack and verify explainable runtime decision trace (including no-trade output)`

## NEXT
- [ ] `MBA-23 feat(obs): add metrics for group-evaluation latency, subagent timeout rate, merge outcomes, and no-trade frequency`
- [ ] `MBA-24 feat(ops): add circuit-breaker and graceful degradation (assistant off -> strategy-only runtime)`
- [ ] `MBA-25 feat(ai-policy): enforce mandate boundaries and forbidden-action policy before execution approval`
- [ ] `MBA-26 feat(ui-explainability): add decision timeline by bot/group/strategy/main-agent/subagent with rationale payloads`
- [ ] `MBA-27 test(parity): validate backtest/paper/live decision parity with shared assistant orchestration inputs`
- [ ] `MBA-28 perf(load): benchmark target profile (3 bots x 4 groups x 4 strategies x 5 agents) and set SLO thresholds`
- [ ] `MBA-29 docs(runbook): publish operator runbook for assistant incidents, fallback modes, and safe recovery`
- [ ] `MBA-30 release(v1-gate): collect evidence pack and close V1 exit criteria for multi-entity assistant runtime`
## BLOCKED
- [ ] `exit-gates(v1-production): production SLO observation window + target-env backup/restore + queue-lag telemetry review + formal release sign-offs`

## DONE
- [x] `MBA-01 audit(domain): mapped current Bot/SymbolGroup/BotStrategy contracts and documented non-breaking migration path (`docs/planning/mba-01-domain-audit-2026-03-22.md`)
- [x] `MBA-02 docs(decisions): locked canonical runtime hierarchy and assistant topology in `docs/planning/open-decisions.md``
- [x] `MBA-03 docs(contract): published deterministic merge contract in `docs/architecture/runtime-signal-merge-contract.md` and linked canonical decision entry in `docs/planning/open-decisions.md``
- [x] `MBA-04 feat(db): added `BotMarketGroup` model (ownership, lifecycleStatus, executionOrder, indexes) in Prisma schema + SQL migration`
- [x] `MBA-05 feat(db): added `MarketGroupStrategyLink` model (priority, weight, deterministic ordering indexes) in Prisma schema + SQL migration`
- [x] `MBA-06 feat(db-migration): added idempotent data backfill from `BotStrategy` into `BotMarketGroup` and `MarketGroupStrategyLink` for zero-downtime rollout`
- [x] `MBA-07 feat(api): added bot market-group CRUD endpoints with zod validation, marketType compatibility checks, and ownership isolation (+ e2e contract case)`
- [x] `MBA-08 feat(api): added strategy-link endpoints under bot market-group (list/attach/update/reorder/detach) with ownership validation and deterministic priority ordering`
- [x] `MBA-09 feat(api): added `/dashboard/bots/:id/runtime-graph` endpoint returning bot->marketGroups->strategyLinks read model with ownership isolation and legacy BotStrategy fallback view`
- [x] `MBA-10 refactor(runtime): refactored runtime signal loop to evaluate bot market-group partitions (symbol-scoped groups, legacy fallback, partition-level signal payload metadata)`
- [x] `MBA-11 feat(runtime): implemented deterministic multi-strategy merge per market-group (EXIT priority, weighted LONG/SHORT votes, tie/weak-consensus => no-trade) with no-flip preserved by pre-trade guardrails`
- [x] `MBA-12 feat(risk): added per-market-group `maxOpenPositions` budget in schema/API/runtime and enforced group cap before pre-trade global/bot checks`
- [x] `MBA-13 test(e2e): added multi-entity e2e contract for one user operating two bots with multiple market-groups and strategy links verified via runtime-graph`
- [x] `MBA-14 docs(ai-contract): published canonical assistant runtime contract (`docs/architecture/assistant-runtime-contract.md`) with responsibilities, I/O, timeout, determinism, and fail-closed behavior`
- [x] `MBA-15 feat(db): added `BotAssistantConfig` model for bot-scoped main agent mandate/profile/safety configuration`
- [x] `MBA-16 feat(db): added `BotSubagentConfig` model with unique `(botId, slotIndex)` and assistant safety profile defaults`
- [x] `MBA-17 feat(api): added assistant config endpoints (`GET/PUT assistant-config`, `PUT/DELETE subagents/:slotIndex`) with slot range 1..4 validation and ownership isolation`
- [x] `MBA-18 feat(runtime-ai): added assistant orchestration scaffold service with planner stage -> slot fan-out -> merge output`
- [x] `MBA-19 feat(runtime-ai): implemented per-slot timeout dispatcher, partial-failure handling, deterministic output ordering and merge`
- [x] `MBA-20 security(ai): added rationale/error sanitization and safe trace writing contract in assistant orchestration flow`
- [x] `MBA-21 feat(ui): added `Assistant` tab in Bots module with main-agent config panel and 4 editable subagent slots (save/delete per slot)`
- [x] `MBA-22 test(e2e): added assistant dry-run endpoint and e2e contract validating configured assistant stack returns explainable trace payload`
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
- [x] `fix(auth-build): resolve client build blockers in login/auth files (eslint apostrophe + hooks deps) so pnpm --filter web build is green`
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
- [x] `fix(auth-session-recovery): enforce automatic logout on invalid session/user-deleted scenarios and add graceful no-db fallback behavior`
- [x] `feat(auth-password-visibility): add password visibility toggle in login/register forms with a11y labels and tests`
- [x] `docs(ia): update module map and user guide navigation references for Bots/Exchanges grouping`
- [x] `docs(repo-structure): define target monorepo apps naming (`apps/web`, `apps/api`, `apps/mobile`) and migration rollout sequence`
- [x] `chore(repo-migration-plan): prepare non-breaking rename plan from client/server to web/api (scripts, CI, env, docs)`
- [x] `docs(parity): define mobile parity contract versus web dashboard scope for MVP/V1`

## Queue Rules
- Keep `NOW` at max 5 tasks.
- Keep one logical change per task.
- If task grows, split before coding.
- After completion, update this file and `docs/planning/mvp-execution-plan.md`.




