# MVP Execution Plan (Agent-Ready)

Goal: deliver a stable MVP in tiny, safe commits.
Rule: fix/cleanup/update first, then feature delivery.

## Plan Governance
- This file is the source of truth for MVP execution.
- `docs/planning/mvp-next-commits.md` is the short operational queue (`NOW` max 5).
- After each merged task: update checkbox + add one line in `Progress Log`.
- If product docs scope changes, update this file before coding.
- Any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`) means: execute exactly one task from `NOW`.

## Global Commit Rules
- One commit = one logical change (typically 1-3 files).
- Commit format: `type(scope): short description`.
- Preferred order: `fix` / `refactor` / `test` / `chore` before `feat`.
- No mixed commits (for example feature + refactor together).

## Audit Remediation Gate (Must Be Done Before Any New Feature Work)
- [x] `P0 security(upload): protect upload endpoint with auth + MIME and size validation + abuse limits`
- [x] `P0 security(live-consent): add consentTextVersion to bot/live consent flow (schema, DTO, persistence, audit)`
- [x] `P1 config(api): harden APP_URL/CORS parsing and remove undefined:* edge cases`
- [x] `P1 config(client): remove hardcoded localhost baseURL and switch to env/runtime-safe config`
- [x] `P1 security(crypto): migrate API-key encryption from CBC to AEAD (AES-GCM or XChaCha20-Poly1305) with key versioning`
- [x] `P1 api(logs): implement real logs API (`/dashboard/logs`) with actor/source/severity filters`
- [x] `P1 infra(rate-limit): replace in-memory limiter with Redis-backed strategy and bounded key growth`
- [x] `P1 qa(test-suite): restore fully green test run for server + client with FK-safe cleanup`
- [x] `P2 auth(session): align remember-me JWT semantics with cookie/session TTL`
- [x] `P2 contract(auth): either implement forgot-password endpoints or remove dead client calls`
- [x] `P2 i18n: remove remaining hardcoded UI strings from dashboard/logs and related views`
- [x] `P3 cleanup(types): remove remaining any in profile routes/controllers`
- [x] `docs(sync): correct plan claims that conflict with actual implementation status`

## Phase 0 - Stabilization and Baseline (Must Finish First)
- [x] `chore(repo): add root workspace scripts for lint/typecheck/test/build`
- [x] `chore(ci): add minimal CI checks for client and server`
- [x] `docs(decisions): freeze MVP strategy schema shape (entry/exit/risk/filters/timeframes)`
- [x] `docs(decisions): resolve preset storage approach for MVP`
- [x] `docs(decisions): close MVP rule nesting depth as explicitly out-of-scope`
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
- [x] `feat(db): add Log model for audit trail`
- [x] `feat(api): markets module CRUD (filters, whitelist/blacklist, auto-exclude rules)`
- [x] `feat(api): bots module CRUD (execution mode, opt-in flags, limits)`
- [x] `feat(api): orders and positions read endpoints`
- [x] `feat(api): ownership checks for all new entities`
- [x] `test(api): add data isolation tests for markets/bots/orders/positions/backtests`

## Phase 2 - Trading Engine Core (Backtest-First)
- [x] `feat(engine): market-data ingestion service (OHLCV) with caching`
- [x] `feat(engine): indicator calculation adapter`
- [x] `feat(engine): rule evaluator (AND/OR + comparisons + multi-timeframe)`
- [x] `feat(engine): pre-trade analysis and position limit checks`
- [x] `feat(engine): simulator with fees/slippage/funding`
- [x] `feat(engine): order types market/limit/stop/stop-limit/take-profit/trailing`
- [x] `feat(engine): TP/SL/trailing/DCA position management`
- [x] `feat(api): backtest run/create/list endpoints`
- [x] `feat(api): backtest trade list and report endpoints`
- [x] `test(engine): deterministic simulator tests for pnl/fees/funding`

## Phase 3 - Paper and Live Futures (MVP Trading Modes)
- [x] `feat(engine): paper runtime loop on live market feed`
- [x] `feat(engine): paper position lifecycle and order simulation parity`
- [x] `feat(exchange): CCXT futures connector scaffold`
- [x] `feat(exchange): live order placement adapter with retries`
- [x] `security(live): explicit live opt-in per bot`
- [x] `security(live): global kill-switch and emergency stop`
- [x] `feat(logs): write audit entries for critical trading decisions`
- [x] `test(e2e): smoke tests for paper/live critical paths`

## Phase 4 - Dashboard Completion (MVP UX Scope)
- [x] `docs(ui): audit legacy CryptoBot dashboard patterns for positions/orders and control-center IA`
- [x] `feat(ui): post-login control-center dashboard with key KPIs, bot status, and quick actions`
- [x] `feat(ui-shell): unify dashboard app shell, page headers, and breadcrumb patterns across modules`
- [x] `feat(ui-state): implement shared loading/empty/degraded/error/success state components`
- [x] `feat(ui-tokens): add semantic risk and execution-mode tokens (paper/live/warning/danger) and reusable status badges`
- [x] `feat(ui-control-center): add sticky safety bar with mode/connectivity/heartbeat and emergency action`
- [x] `feat(ui-control-center): add risk notice footer with logs drill-down shortcut`
- [x] `feat(ui): dashboard/markets flow`
- [x] `feat(ui): dashboard/builder strategy editor + presets`
- [x] `feat(ui): dashboard/bots management + mode status`
- [x] `feat(ui): dashboard/orders and dashboard/positions`
- [x] `feat(ui): dashboard home widgets for live positions/orders snapshot and recent actions feed`
- [x] `feat(ui): dashboard/backtest full UX + overlays + summary`
- [x] `feat(ui): dashboard/reports performance views`
- [x] `feat(ui): dashboard/logs audit trail backed by real logs API`
- [x] `feat(ui): dashboard/exchanges api-key connections`
- [x] `feat(ui-nav): rename Execution to Bots and move Orders/Positions under Exchanges dropdown between Dashboard and Markets`
- [x] `feat(i18n): EN default + PL translation coverage`
- [x] `feat(i18n): enforce translation-key usage (no hardcoded page copy) and feature-based namespaces`
- [x] `feat(i18n): locale-aware date/number/currency/percent formatting for dashboard data views`
- [x] `feat(ui): responsive pass for desktop/tablet/mobile`
- [x] `feat(ui): PWA baseline parity for core flows`
- [x] `feat(a11y): keyboard/focus/semantic heading baseline for core dashboard pages`
- [x] `test(ui): EN/PL key coverage and responsive smoke tests`
- [x] `test(ui): view-state consistency tests for loading/empty/degraded/error/success`
- [x] `test(ux): control-center 10-second operator clarity checklist`

## Phase 5 - MVP Closure and Release Readiness
- [x] `docs(ops): MVP runbook for deployment and recovery`
- [x] `docs(risk): user-facing trading risk notice and live consent text`
- [x] `docs(release): known limits and post-MVP boundaries`
- [x] `chore(release): MVP release checklist and changelog`

## Phase 6 - MVP Freeze Gap Closure (As of 2026-03-19)
- [x] `feat(market-stream): implement Binance WebSocket ingest worker for normalized ticker/candle runtime feed`
- [x] `decision(stream): close SSE vs WebSocket fan-out decision and lock MVP transport contract`
- [x] `feat(ui): add dashboard live market bar with stream status, last price, and candle freshness`
- [x] `feat(orders-write): add open/cancel/close order actions with risk-first confirmations`
- [x] `feat(execution-orchestrator): wire signal -> order -> position lifecycle for paper/live runtime paths`
- [x] `feat(positions-live): add live position reconciliation/update loop`
- [x] `feat(backtest): finalize chart overlays and report visualizations to MVP-complete state`
- [x] `test(e2e): add runtime orchestration smoke path covering stream -> signal -> order -> position updates`

## Phase 7 - Runtime Replacement Gate (As of 2026-03-21)
- [x] `audit(reverify): re-validate P0/P1 audit findings in code and tests before further expansion`
- [x] `feat(stream-fanout): expose SSE stream endpoint and connect dashboard live market bar to server-owned stream`
- [x] `feat(runtime-loop): complete continuous stream -> signal evaluation loop in worker runtime`
- [x] `feat(runtime-management): manage manually opened Binance Spot/Futures positions through runtime lifecycle`
- [x] `feat(runtime-management): guarantee DCA/SL/TP/TSL automation until position close`
- [x] `feat(runtime-scans): periodic market/position scans with configurable interval and market filters`
- [x] `test(e2e): expand strategy -> backtest -> paper -> live opt-in flow with runtime assertions`
- [x] `chore(release): re-run MVP checklist with evidence after runtime replacement gate`
## MVP Exit Criteria
- [x] Phase 0 fully complete.
- [x] End-to-end flow works: strategy -> backtest -> paper -> live opt-in.
- [x] Security guardrails active: encryption, ownership checks, rate limits, audit logs.
- [x] Core tests passing for auth, strategy CRUD, market/bot isolation, and trading critical paths.
- [x] UI scope complete for markets, builder, bots, orders, positions, backtest, reports, logs, exchanges.
- [x] EN/PL and responsive/PWA baseline complete for core flows.
- [x] Shared app shell and view-state model are consistent across core dashboard modules.
- [x] Real-time market stream is visible in dashboard control center via server-owned transport.
- [x] Write-side order actions (open/cancel/close) are available with risk-first confirmations.
- [x] Runtime replacement gate for legacy local-only bot flow is validated with evidence.

## Phase 8 - Operational Evidence and Full-App Readiness
- [x] `ops(cutover): define local cutover checklist from legacy bot to new runtime`
- [x] `ops(cutover): define rollback checklist to legacy runtime`
- [x] `test(cutover): execute local replacement dry-run with realistic bot scenario`
- [x] `docs(sync): reconcile roadmap immediate gaps with actual runtime status and evidence links`
- [x] `ops(slo): define MVP/V1 SLO set and map measurable targets to existing source metrics`
- [x] `ops(slo): define SLOs and attach live metrics evidence`
- [x] `ops(evidence): execute production-like load baseline and document pass/fail thresholds`
- [x] `security(audit): produce final ownership/auth/key-flow verification report`
- [x] `release(evidence): finalize launch evidence pack (public docs + operator docs + checklists)`
- [x] `release(review): complete 7-day launch review and V1.1 backlog cut`
- [x] `docs(sync): normalize planning files so roadmap/mvp/v1 statuses are fully consistent`
- [x] `post-mvp(admin): plan owner admin panel milestones for pricing/subscriptions/settings`
- [x] `post-mvp(billing): plan monthly/annual + fiat/crypto billing rollout milestones`
- [x] `post-mvp(exchange): plan adapter rollout for exchanges beyond Binance`

## Phase 9 - Exchange API-Key Verification and Live Position Trust Gate (As of 2026-03-21)
- [x] `P0 auth-stabilization-gate: ensure client build is green for auth/login scope before exchange api-key trust work`
- [x] `fix(auth-ux): harden failed-login UX so success feedback appears only after confirmed session refresh`
- [x] `fix(auth-session-warning): show session-expired warning only for protected or explicit expired-session contexts`
- [x] `test(auth-client): add regression tests for login fail/success/session-refresh redirect behavior`
- [x] `P1 auth-ux-regression: confirm failed/success login UX and redirect/session-warning behavior with regression tests + manual smoke evidence`
- [x] `fix(ui-api-key-test): replace random "Testuj polaczenie" result with real backend API call and deterministic status states`
- [x] `feat(api-key-test-api): add authenticated endpoint to validate provided exchange credentials against Binance permissions`
- [x] `security(api-key-test): ensure test endpoint never persists raw secrets, enforces auth/rate limits, and logs audit-safe metadata only`
- [x] `feat(exchange-validation): map Binance auth/permission errors into stable API contract (invalid key, invalid secret, ip restricted, missing futures/spot scope, network timeout)`
- [x] `feat(profile-save-flow): require successful connection test before allowing LIVE-ready API-key save (with explicit override off by default)`
- [x] `feat(api-key-onboarding): add sync_external_positions and manage_external_positions options`
- [x] `feat(runtime-guard): enforce no-flip and manual-managed symbol ignore rules in runtime execution flow`
- [x] `feat(positions-sync): use verified stored key to fetch real open positions snapshot from Binance and expose read endpoint`
- [x] `feat(ui-positions-live-source): add source switch/state in positions view (runtime snapshot vs exchange-live snapshot) and last-sync timestamp`
- [x] `feat(positions-ui): show position source and management mode badges plus explicit toggle action`
- [x] `test(e2e): add profile/api-key and positions contract tests covering invalid credentials, permission mismatch, and successful live fetch`
- [x] `docs(runbook): document secure API-key onboarding and troubleshooting flow for Binance connection/permissions failures`
- [x] `feat(db): add position/order/trade origin + management mode fields with migration baseline`

## Phase 10 - Navigation, IA, Routing, and Auth Session Hardening (As of 2026-03-22)
- [x] `fix(ui-header-nav): center desktop nav list, remove legacy visual utility clutter, and unify header hover/active/focus styles`
- [x] `fix(ui-language-switcher): correct EN/PL flag visuals and lock language-switcher visual contract with regression tests`
- [x] `audit(routing): create canonical route map and remove dashboard path inconsistencies (including legacy aliases)`
- [x] `refactor(ia-profile): merge API keys and exchange connections under one settings domain model`
- [x] `fix(ui-profile): remove isometric mode toggle from current dashboard account menu (defer to V2 gamification)`
- [ ] `fix(auth-session): force deterministic auto-logout on invalid auth/session or deleted-user state`
- [ ] `fix(auth-resilience): handle API/DB-unavailable startup in auth context without stale logged-in UI state`
- [ ] `feat(auth-ui): add password visibility toggle to login/register with keyboard and screen-reader support`
- [ ] `docs(repo-structure): define staged migration from apps/client+apps/server to apps/web+apps/api and add apps/mobile bootstrap plan`
- [ ] `docs(parity): define mobile parity contract versus web dashboard scope for MVP/V1`

## Phase 11 - Audit Closure and Scope Realignment (As of 2026-03-22)
- [x] `docs(sync): remove contradictory done/pending states across MVP/V1 plans and align all status claims to repository evidence`
- [x] `test(quality-gate): restore and verify green core test suites before reopening feature expansion`
- [x] `docs(scope): move admin+billing implementation promises to post-MVP/V1.1 and keep V1 docs aligned with current deliverables`
- [ ] `feat(stream-contract): deliver stream transport contract requirements (event id, ping heartbeat, max symbols guard)`
- [ ] `fix(routing-hard-cut): hard-canonize dashboard URLs and remove legacy alias ambiguity`
- [ ] `fix(i18n-contract): remove hardcoded copy and align locale default contract (EN default vs runtime html lang)`
- [ ] `security(ops-endpoints): protect /metrics, /alerts, /workers/* with explicit access control`
- [ ] `fix(live-contract): enforce LIVE real-exchange side effects; keep simulation strictly in PAPER/BACKTEST`
- [ ] `refactor(rate-limit): evolve limiter model toward user/exchange-key aware enforcement`

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
- 2026-03-15: Added Log Prisma model for audit trail with severity, source, actor, metadata, and ownership relations.
- 2026-03-15: Added markets API CRUD for market universes with validation, ownership checks, and e2e contract coverage.
- 2026-03-15: Added bots API CRUD with execution mode, live opt-in, position limits, ownership checks, and e2e coverage.
- 2026-03-15: Added read-only orders and positions API endpoints with query filters, ownership checks, and e2e coverage.
- 2026-03-15: Standardized ownership behavior to return 404 on foreign resources for strategy and api-key update/delete paths.
- 2026-03-15: Added cross-module data isolation e2e coverage for markets, bots, orders, positions, and backtest datasets.
- 2026-03-15: Added market-data OHLCV ingestion service with in-memory TTL caching and unit coverage for cache hit, expiry, and force refresh.
- 2026-03-15: Added indicator calculation adapter for SMA, EMA, and RSI with unit coverage for warmup and output ranges.
- 2026-03-15: Added rule evaluator service for AND/OR comparison rules with multi-timeframe indicator snapshot support.
- 2026-03-15: Added pre-trade analysis service with live opt-in enforcement and user/bot/symbol open-position limit checks.
- 2026-03-15: Added deterministic trade simulator with fee, slippage, and funding cost accounting plus unit coverage.
- 2026-03-15: Added order type evaluator for market, limit, stop, stop-limit, take-profit, and trailing with stateful trigger handling.
- 2026-03-15: Added position management engine for TP/SL/trailing stop and DCA with deterministic state transitions.
- 2026-03-15: Added backtests API endpoints for run create/list/get with ownership checks and strategy ownership validation.
- 2026-03-15: Added backtests API endpoints for run trades list and run report read with ownership isolation and e2e coverage.
- 2026-03-15: Expanded simulator unit coverage for deterministic repeats, accounting identity, and explicit slippage cost regression cases.
- 2026-03-15: Added paper runtime service loop for polling live market feed with stop control and per-symbol non-overlapping tick execution.
- 2026-03-15: Added paper lifecycle orchestrator for order execution parity, position management (DCA/TP/SL/trailing), and deterministic simulated close-out PnL.
- 2026-03-15: Added CCXT futures connector scaffold with lazy client init, sandbox support, mark-price fetch, and normalized futures order placement contract.
- 2026-03-15: Added live order adapter with retry/backoff policy for retryable exchange failures and deterministic unit coverage.
- 2026-03-15: Enforced explicit live opt-in per bot in pre-trade checks by validating bot ownership, LIVE mode, and liveOptIn flag from store data.
- 2026-03-15: Added live pre-trade kill controls via global kill-switch and emergency-stop guards with deterministic test coverage.
- 2026-03-15: Added audit log writes for critical pre-trade decisions (allowed/blocked in LIVE and blocked decisions) with non-blocking failure handling.
- 2026-03-15: Synced MVP UX tasks with new `ui-ux-foundation.md` baseline (shell, states, tokens, control-center safety patterns, i18n, accessibility).
- 2026-03-15: Unified dashboard shell spacing and page-header/breadcrumb patterns across control center, strategies, backtest, and profile views.
- 2026-03-15: Added pre-trade smoke e2e coverage for critical paper/live paths, including live allow, kill-switch block, and audit-log assertions.
- 2026-03-15: Added shared UI state components (loading, empty, degraded, error, success) with dashboard integration and unit coverage.
- 2026-03-15: Added sticky control-center safety bar with mode, connectivity, heartbeat status, and emergency navigation action.
- 2026-03-15: Added control-center risk notice footer with direct shortcuts to audit logs and security settings.
- 2026-03-15: Added semantic UI tokens for execution mode and risk levels with reusable status badge component integrated into safety bar.
- 2026-03-15: Implemented dashboard markets flow with market-universe list/create/delete wired to backend markets API and UI-state handling.
- 2026-03-15: Closed MVP decision on rule nesting depth as out-of-scope beyond top-level logic with flat rules.
- 2026-03-15: Added dashboard builder page with code-defined strategy presets and editor flow wired to strategy create endpoint.
- 2026-03-15: Added bots management dashboard flow with CRUD wiring, mode/risk status badges, and inline control updates.
- 2026-03-16: Added dashboard orders and positions pages with backend-powered filters, table views, and component test coverage.
- 2026-03-16: Replaced dashboard home mocks with live orders/positions widgets and recent activity feed sourced from API data.
- 2026-03-16: Implemented full backtest UX with run creation/list, trades tab, summary cards, and modal overlay wired to backtests API.
- 2026-03-16: Added reports performance view with aggregated KPI cards and per-run backtest report table sourced from reports API.
- 2026-03-16: Added logs audit trail dashboard view with source filters and derived event stream from orders/positions/backtests.
- 2026-03-16: Added exchanges dashboard view for API-key connections with connection summary cards and profile API-key management integration.
- 2026-03-16: Added i18n provider with EN default locale, PL shell translations, language switcher, and shell-level translation wiring with i18n tests.
- 2026-03-16: Enforced typed translation keys and moved dashboard shell copy into feature-based `dashboard.*` namespaces.
- 2026-03-16: Added locale-aware date/time/number/currency/percent formatting utilities and integrated them across core dashboard data views.
- 2026-03-16: Improved dashboard shell responsiveness for mobile/tablet with wrapping header nav, horizontal nav scrolling, and small-screen safety-bar/page-title adjustments.
- 2026-03-16: Added PWA baseline with manifest metadata, installable icons, service worker registration, runtime caching, and offline fallback route.
- 2026-03-16: Added accessibility baseline with skip-to-content support, keyboard focus-visible styles, and clearer landmark semantics for dashboard/public layouts.
- 2026-03-16: Added UI test coverage for EN/PL translation-key parity and responsive dashboard-header smoke rendering.
- 2026-03-16: Extended shared ViewState tests for consistent title/description rendering and action-button visibility rules across loading/empty/degraded/error/success variants.
- 2026-03-16: Added manual UX checklist for 10-second control-center operator clarity and linked it in testing strategy docs.
- 2026-03-16: Added MVP operations runbook covering deployment steps, health verification, rollback, and recovery playbooks.
- 2026-03-16: Added MVP user-facing risk notice and live-consent text pack (EN/PL) with consent-versioning and audit logging guidance.
- 2026-03-16: Added audit remediation gate (P0-P3) and reprioritized queue before any further feature work.
- 2026-03-16: Secured avatar upload endpoint with auth, rate limiting, strict MIME/size validation, and upload e2e coverage.
- 2026-03-16: Added `consentTextVersion` across bot live-consent flow with persistence, API validation, pre-trade enforcement, and audit logging.
- 2026-03-16: Hardened runtime URL/CORS parsing in server config and switched client API base URL to env-driven setup.
- 2026-03-16: Migrated API-key encryption to AES-GCM with key versioning and legacy CBC backward compatibility during decrypt.
- 2026-03-16: Restored fully green server/client tests by adding FK-safe cleanup coverage and consistent Next router test mocks.
- 2026-03-16: Implemented `/dashboard/logs` backend with source/actor/severity filtering and wired logs dashboard to real API data.
- 2026-03-16: Replaced in-memory rate limiting with Redis-backed counters and TTL-based bounded key growth, with local fallback.
- 2026-03-16: Unified remember-me JWT and cookie TTL semantics with explicit auth session constants and e2e coverage.
- 2026-03-16: Removed dead forgot-password client call paths to align auth contract with implemented backend endpoints.
- 2026-03-16: Replaced hardcoded logs/dashboard copy with translation keys and wired logs view/page to i18n provider keys.
- 2026-03-16: Removed remaining `any` usage in profile routes/controllers and replaced with typed request/validation flow.
- 2026-03-16: Added explicit MVP known limits and post-MVP boundary document for release communication.
- 2026-03-16: Added MVP release checklist and project changelog for closure readiness.
- 2026-03-16: Synced stale plan checkboxes to match delivered logs API and i18n hardcoded-copy cleanup status.
- 2026-03-16: Updated MVP exit criteria to reflect verified guardrails, green core suites, and completed UI/i18n shell baselines.
- 2026-03-16: Added automated server e2e smoke flow for strategy -> backtest -> paper -> live opt-in guardrail path.
- 2026-03-19: Continued post-MVP queue performance hardening by adding env-tunable worker queue profiles in V1 release track.
- 2026-03-19: Added post-MVP load baseline/stress test runner and execution docs for API and worker monitoring endpoints.
- 2026-03-19: Began V1 spot-trading expansion with connector-level market type switch (`future`/`spot`) and safety guard for futures-only order params.
- 2026-03-19: Added strategy import/export API flow with explicit `strategy.v1` format-version contract for post-MVP product expansion.
- 2026-03-19: Added V1 production operator handbook covering shift checks, monitoring cadence, deployment safety, and incident operation flow.
- 2026-03-19: Added V1 user guide with onboarding, safety recommendations, FAQ, troubleshooting, and live-readiness checklist.
- 2026-03-19: Completed localization QA baseline via EN/PL parity checks, locale-formatting tests, and release checklist documentation.
- 2026-03-19: Added optional dashboard isometric visual mode with persistent toggle and targeted UI test coverage.
- 2026-03-19: Improved dashboard accessibility controls with stronger menu semantics and heartbeat status live-region announcements.
- 2026-03-19: Synced module map docs with strategy import/export support and explicit `strategy.v1` package contract.
- 2026-03-19: Added logs decision-trace explorer UX with per-event metadata drill-down and trace visibility for audit workflows.
- 2026-03-19: Added risk-first confirmation prompts for LIVE bot transitions (mode/opt-in/activation) to reduce accidental live exposure.
- 2026-03-19: Added shared dashboard design-system documentation covering reusable UI primitives, semantic tokens, and conformance gates.
- 2026-03-19: Completed dashboard accessibility pass with active navigation semantics, improved control labels/live regions, and audit checklist documentation.
- 2026-03-19: Added V1 release-candidate checklist to formalize go-live quality/security/ops gates and sign-off flow.
- 2026-03-19: Added V1 stabilization freeze and bug-bash plan to control pre-release change scope and defect triage SLAs.
- 2026-03-19: Added V1 post-release monitoring and hotfix protocol with severity-based response model and verification records.
- 2026-03-19: Added 7-day launch review template and V1.1 backlog-cut framework for post-launch decision cadence.
- 2026-03-19: Added V1 changelog and migration notes to formalize release communication and rollout expectations.
- 2026-03-19: Added go-live smoke-pack scripts and docs; client smoke suite passed, server e2e smoke pending Docker DB availability.
- 2026-03-19: Continued spot-trading delivery by adding bot `marketType` schema/API field (`FUTURES`/`SPOT`) with migration and generated Prisma client.
- 2026-03-19: Extended bot market-type support to dashboard UI for create/edit flows, aligned with spot-trading rollout.
- 2026-03-19: Improved spot-support compatibility by normalizing uppercase bot `marketType` aliases (`FUTURES`/`SPOT`) in the CCXT connector config path.
- 2026-03-19: Improved bots dashboard UX for spot support by adding a market filter and correcting table market/status column alignment.
- 2026-03-19: Extended pre-trade live-path context by including bot `marketType` in live config reads and audit metadata for decision traceability.
- 2026-03-19: Extended risk-first UX in bot control center with mandatory confirmation before deleting active or LIVE-enabled bots.
- 2026-03-19: Removed client hook dependency warnings by adding missing `router` dependencies in auth/dashboard route guard effects.
- 2026-03-19: Reduced client lint/type noise by cleaning profile hook catches/effects and aligning backtest form resolver typing with `z.coerce` output.
- 2026-03-19: Improved Next.js image best-practice alignment by migrating dashboard/public header logos from `<img>` to `next/image`.
- 2026-03-19: Migrated profile avatar preview to `next/image` (`loader` + `unoptimized`) and reached warning-free client production build.
- 2026-03-19: Added risk-acknowledgment guard for API-key deletion in profile/exchange flows and covered it with dedicated UI test.
- 2026-03-19: Updated metadata/landing copy from futures-only wording to spot+futures messaging to match ongoing product expansion.
- 2026-03-19: Added optional bots-list `marketType` query filtering (`FUTURES`/`SPOT`) for API-side segmentation in spot rollout workflows.
- 2026-03-19: Connected dashboard bot market filter to API query (`marketType`) so SPOT/FUTURES views are served directly from backend.
- 2026-03-19: Added go-live helper scripts for Docker infra up/down and `test:go-live:server:with-infra` orchestration to streamline smoke execution.
- 2026-03-19: Started hedge-mode groundwork by adding bot `positionMode` (`ONE_WAY`/`HEDGE`) to Prisma schema, API validation, and contract assertions.
- 2026-03-19: Exposed bot `positionMode` in dashboard create/edit flows and synchronized client bot tests with the new ONE_WAY/HEDGE contract.
- 2026-03-19: Completed hedge-mode backend flow by validating HEDGE `positionSide` in futures connector orders and extending pre-trade audit metadata with bot `positionMode`.
- 2026-03-19: Finalized spot connector behavior by validating SPOT order contract and rejecting futures-only order params in live execution flow.
- 2026-03-19: Added go-live smoke orchestrator script with automatic infra up/down lifecycle to make server/client smoke runs reproducible and cleanup-safe.
- 2026-03-19: Added advanced pre-trade risk limit evaluation for daily loss, drawdown, and consecutive losses with regression tests.
- 2026-03-19: Added post-loss cooldown guardrail evaluation in pre-trade risk checks with deterministic unit tests for active/elapsed cooldown windows.
- 2026-03-19: Added optional market-data adapters for order book, funding rate, and open interest snapshots with validated request contracts and tests.
- 2026-03-19: Validated full go-live smoke flow end-to-end (Docker infra lifecycle + Prisma migrate deploy + server/client smoke suites) with green result.
- 2026-03-19: Added MVP freeze-gap closure phase (stream transport, live market bar, write-side orders, orchestrator wiring) from updated roadmap/product limits.
- 2026-03-19: Added Binance market-stream worker scaffold with normalized ticker/kline event parsing for upcoming live dashboard stream fan-out.
- 2026-03-22: Added origin/management/sync metadata baseline in Position/Order/Trade models with migration and indexes for runtime ownership and reconciliation flows.
- 2026-03-22: Added API-key onboarding options (`syncExternalPositions`, `manageExternalPositions`) across Prisma, profile API contracts, form switches, and regression tests.
- 2026-03-22: Added runtime execution guards for no-flip behavior and manual-managed symbol ignore rules in signal loop/orchestrator flow with regression tests.
- 2026-03-22: Extended positions module UX with source/management badges plus management-mode toggle action and ownership-safe API endpoint coverage.
- 2026-03-22: Replanned with audit-first closure queue (truthful docs status, green tests gate, stream contract completion, routing hard-cut, live-contract alignment, and admin/billing scope realignment to post-MVP).
- 2026-03-19: Closed stream transport decision for MVP (SSE fan-out) and documented event contract plus reliability rules for frontend/backend integration.
- 2026-03-19: Implemented dashboard live market bar component with SSE listener and UI indicators for price, 24h delta, candle freshness, and stream health state.
- 2026-03-19: Added orders write-side API (`open`/`cancel`/`close`) with LIVE risk acknowledgments, bot eligibility guards, and contract e2e coverage.
- 2026-03-19: Wired runtime execution orchestrator service for signal -> order -> position lifecycle (LONG/SHORT/EXIT) with paper/live-compatible flow contracts.
- 2026-03-19: Added live position reconciliation loop with heartbeat/status exposure (`/dashboard/positions/live-status`) and execution-worker startup integration.
- 2026-03-19: Finalized backtest overlay/report visuals with equity-curve rendering in summary and modal report views, plus passing backtest component tests and client production build.
- 2026-03-19: Added runtime smoke e2e flow for normalized stream signal ingestion through orchestrator order/position lifecycle (LONG open + EXIT close) and hardened EXIT handling for already-filled market orders.
- 2026-03-19: Synced MVP docs to freeze-gap delivery state (scope/limitations/modules/runtime notes), including explicit distinction between delivered ingest/orchestration pieces and remaining SSE fan-out automation gap.
- 2026-03-19: Re-ran MVP release checklist with fresh build/test/migration evidence (server/client builds green, full server/client tests green, migrations verified as up-to-date).

- 2026-03-21: Replanned queue around runtime-replacement gate and immediate roadmap gaps (stream fan-out, runtime loop, managed position lifecycle).
- 2026-03-21: Re-verified upload endpoint security contract by adding explicit >2MB avatar regression test and confirming auth/MIME/size guard responses in upload e2e suite.
- 2026-03-21: Re-verified LIVE `consentTextVersion` flow with regression coverage across DTO validation, API responses, DB persistence, and audit-log metadata on create/update bot paths.
- 2026-03-21: Implemented Redis-backed market-stream fan-out (`/dashboard/market-stream/events` SSE), connected worker event publishing, and added regression coverage for stream route auth contract.
- 2026-03-21: Added runtime signal loop in execution worker (`stream ticker -> signal creation -> pre-trade guard -> execution orchestrator`) with deterministic unit coverage and worker startup integration.
- 2026-03-21: Re-ran MVP release checklist after runtime-replacement updates; confirmed server/client build+test green and Prisma migrations up-to-date, and refreshed release evidence counts.
- 2026-03-21: Re-validated P0/P1 audit findings with focused regression suite (`upload`, `bots consent`, `logs`, `crypto`) and refreshed remediation evidence log.
- 2026-03-21: Extended runtime loop to include manual open-position lifecycle handling by processing `EXIT` signals for `botId=null` positions (signal persistence + orchestrated close path).
- 2026-03-21: Added runtime position automation manager for open-position SL/TP/trailing/DCA handling on stream ticker updates, including DCA persistence and auto-close orchestration paths.
- 2026-03-21: Added runtime scan loop with configurable interval/symbol cap/env-filter to periodically reprocess latest ticker snapshots for open-position and signal automation flows.
- 2026-03-21: Expanded runtime flow e2e coverage for strategy -> backtest -> LIVE bot runtime path (ticker LONG open + EXIT close) and aligned test contracts with current strategies/backtests API routes.
- 2026-03-21: Synced product/architecture/modules/trading docs to runtime replacement reality (server SSE fan-out + runtime signal loop + position automation), and removed stale staged-gap wording from current limitations.

- 2026-03-21: Added Phase 8 for operational evidence, launch-readiness proof, and post-MVP expansion planning milestones.
- 2026-03-21: Reconciled `docs/planning/roadmap.md` with delivered runtime-stream state (SSE fan-out + runtime loop + management automation) and linked current V1 evidence artifacts/runbooks.
- 2026-03-21: Added MVP/V1 SLO catalog (`docs/operations/v1-slo-catalog.md`) with measurable objectives and direct mapping to live source metrics (`/metrics`, `/alerts`, health/readiness probes).
- 2026-03-21: Ran production-like API load baseline and documented thresholds/evidence in `docs/operations/v1-load-baseline-2026-03-21.md` with raw artifact export.
- 2026-03-21: Published final security verification report (`docs/security/security-audit-verification-2026-03-21.md`) after focused auth/ownership/api-key/guardrail regression run (`9` files, `34` tests).
- 2026-03-21: Compiled launch evidence pack (`docs/operations/v1-launch-evidence-pack.md`) aggregating public/operator/security/load/RC artifacts and current external-gate blockers.
- 2026-03-21: Added local legacy-to-new-runtime cutover checklist (`docs/operations/v1-local-cutover-checklist.md`) with prechecks, safe enable order, validation, and abort criteria.
- 2026-03-21: Added local rollback checklist (`docs/operations/v1-local-rollback-checklist.md`) to safely return execution ownership to legacy runtime on cutover failure.
- 2026-03-21: Executed local replacement dry-run and published evidence (`docs/operations/v1-local-cutover-dry-run-2026-03-21.md`) with green server/client cutover-critical suites.
- 2026-03-21: Completed launch retrospective and V1.1 backlog cut in `docs/operations/v1-launch-review-2026-03-21.md` (pre-launch evidence window, prioritized follow-ups).
- 2026-03-21: Normalized planning consistency across roadmap/MVP/V1 files; aligned blocked exit-gate wording to remaining production-only dependencies.
- 2026-03-21: Added post-MVP admin-panel milestone plan (`docs/planning/post-mvp-admin-panel-milestones.md`) covering entitlements, grants/overrides, security controls, visibility, and rollout hardening.
- 2026-03-21: Added post-MVP billing rollout milestones (`docs/planning/post-mvp-billing-milestones.md`) for annual cycle support and phased fiat/crypto rail integration.
- 2026-03-21: Added post-MVP exchange rollout milestones (`docs/planning/post-mvp-exchange-rollout-milestones.md`) for adapter hardening, staged enablement, and multi-exchange guardrails.
- 2026-03-21: Attached live-source metrics evidence to SLO baseline via `docs/operations/v1-slo-catalog.md` and `docs/operations/v1-load-baseline-2026-03-21.md`; remaining SLO blocker is production observation window.
- 2026-03-21: Added Phase 9 trust gate for real Binance API-key verification flow and exchange-live positions snapshot path (UI + API + security + tests + runbook).
- 2026-03-21: Re-prioritized Phase 9 with auth stabilization gate (client build green + login UX/session-warning regression evidence) before exchange API-key trust implementation.
- 2026-03-21: Closed Phase 9 auth build gate by fixing AuthContext hook deps and LoginForm lint issue; verified with green `pnpm --filter client build` and targeted auth suites.
- 2026-03-21: Hardened failed-login UX by requiring confirmed `refetchUser()` session before success toast/redirect in login flow; verified with green `pnpm --filter client build`.
- 2026-03-21: Hardened session-expiry warning logic to avoid false public-route warnings by requiring protected-route context or explicit `session=expired` hint.
- 2026-03-21: Added client auth regression tests in `useLoginForm.test.tsx` covering failed login, successful login with redirect, and session-refresh failure handling.
- 2026-03-21: Captured auth smoke evidence in `docs/operations/auth-smoke-2026-03-21.md` (`_artifacts-auth-smoke-2026-03-21.json`), covering failed login, successful login, logout cookie clear, and protected-route redirect.
- 2026-03-21: Replaced random API-key connection test result in profile form with real `POST /dashboard/profile/apiKeys/test` request state flow (`idle/loading/success/error`) and added deterministic UI regression tests.
- 2026-03-21: Added authenticated `POST /dashboard/profile/apiKeys/test` endpoint with Zod validation and no-persistence contract, plus e2e coverage for auth gate and DB non-write guarantee.
- 2026-03-21: Hardened API-key test endpoint with dedicated rate limit and audit log entries containing only safe metadata (`exchange`, `ok`) with e2e assertion that secrets are not logged.
- 2026-03-21: Added Binance API-key probe service with normalized error mapping contract (`OK`, `INVALID_KEY`, `INVALID_SECRET`, `IP_RESTRICTED`, `MISSING_SPOT_SCOPE`, `MISSING_FUTURES_SCOPE`, `NETWORK_TIMEOUT`, `UNKNOWN`) and unit coverage.
- 2026-03-21: Added API-key test e2e scenarios for success, invalid credentials (`INVALID_KEY`), and futures permission mismatch (`MISSING_FUTURES_SCOPE`) with stable contract assertions.
- 2026-03-21: Enforced profile API-key save gate requiring successful connection test for current credentials within form session and added UI regression tests for blocked/allowed save paths.
- 2026-03-21: Added `GET /dashboard/positions/exchange-snapshot` with Binance open-positions fetch via decrypted stored key, normalized response contract, and e2e coverage for auth/no-key/success paths.
- 2026-03-21: Extended positions dashboard UI with source switch (`runtime` vs `exchange live snapshot`), exchange snapshot mapping, symbol filtering, and last-sync timestamp rendering.
- 2026-03-21: Added positions live-source regression coverage: UI tests for source switch + snapshot failure state and server e2e for exchange snapshot failure contract (`502`).
- 2026-03-21: Added Binance API-key onboarding/troubleshooting runbook with permission/code mapping and linked it from README and MVP ops runbook.
- 2026-03-22: Updated dashboard IA navigation: `Execution` renamed to `Bots`; `Orders` and `Positions` moved under `Exchanges` dropdown placed between `Dashboard` and `Markets`, with header responsive test updates.
- 2026-03-22: Added Phase 10 planning queue for header/nav consistency, routing normalization, profile IA cleanup, auth session resilience, and repo `web/api/mobile` migration documentation.
- 2026-03-22: Updated dashboard header desktop navigation alignment and unified nav control interaction states (hover/active/focus), with responsive regression coverage.
- 2026-03-22: Replaced incorrect EN locale flag styling in dashboard language switcher with explicit SVG flag icons and added visual-contract regression test coverage.
- 2026-03-22: Added canonical dashboard route map and normalized header route contracts to canonical paths while preserving alias-aware active state behavior.
- 2026-03-22: Merged exchange connections and API key management into one profile settings domain (`#api`) and routed `/dashboard/exchanges` to unified settings entrypoint.
- 2026-03-22: Removed isometric mode toggle from dashboard account menu and kept profile dropdown focused on account/security/integration actions only.
- 2026-03-22: Synced audit planning truthfulness by reconciling Phase 10 statuses with implemented commits and removing contradictory pending states across queue and execution plans.
- 2026-03-22: Restored quality-gate green status by aligning i18n provider test with current language switcher contract and seeding requireAuth rotation test with a real DB user; reran core client/server suites with full pass.
- 2026-03-22: Realigned docs scope so admin+billing capabilities are explicitly tracked as post-MVP/V1.1 (roadmap/product/user-guide + V1 plan G0), removing implied V1 delivery claims.




