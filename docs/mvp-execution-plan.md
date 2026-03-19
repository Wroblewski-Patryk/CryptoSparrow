# MVP Execution Plan (Agent-Ready)

Goal: deliver a stable MVP in tiny, safe commits.
Rule: fix/cleanup/update first, then feature delivery.

## Plan Governance
- This file is the source of truth for MVP execution.
- `docs/mvp-next-commits.md` is the short operational queue (`NOW` max 5).
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

## MVP Exit Criteria
- [x] Phase 0 fully complete.
- [x] End-to-end flow works: strategy -> backtest -> paper -> live opt-in.
- [x] Security guardrails active: encryption, ownership checks, rate limits, audit logs.
- [x] Core tests passing for auth, strategy CRUD, market/bot isolation, and trading critical paths.
- [x] UI scope complete for markets, builder, bots, orders, positions, backtest, reports, logs, exchanges.
- [x] EN/PL and responsive/PWA baseline complete for core flows.
- [x] Shared app shell and view-state model are consistent across core dashboard modules.

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
