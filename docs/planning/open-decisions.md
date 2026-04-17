# Open Decisions

This file tracks intentionally unresolved architecture choices so implementation can proceed without losing context.

## V1 Delivery Priority
- Decision state: resolved on 2026-03-20.
- V1 top priority:
  - achieve stable 24/7 server operation for the new app as practical replacement for legacy local-only bot workflow.
  - favor runtime correctness and operational continuity over non-critical feature expansion.
  - target account model is multi-user from V1 architecture perspective (even if initial operational usage is primarily owner account).
  - minimum legacy-parity capability required before replacing old bot in daily use:
    - strategy configurator with JSON-driven settings.
    - backtester available for strategy validation.
    - runtime bot management of existing manually opened positions on Binance Futures and Binance Spot (position lifecycle managed by automation after detection).
    - position risk automation: DCA, SL, TP, TSL until close (profit, loss, or rule-based close).
    - periodic loop scanning for markets and positions with configurable interval (`x` minutes) and market filters to avoid full-universe scans.
  - implementation preference: use one shared management mechanism configurable by market type, avoiding duplicated per-market logic where practical.
  - runtime cadence policy in V1:
    - scan cadence is configurable, but only via predefined allowed interval list (no free-form values).
    - market-signal scan cadence and open-position management cadence are configured separately.
    - allowed interval lists are constrained to protect shared server performance and abuse resistance.
    - allowed cadence options are entitlement-based by subscription plan (higher tiers can access faster intervals).
    - one global allowed interval catalog in V1 (shared across cadence and indicator/timeframe selectors): `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `8h`, `12h`, `1d`, `1w`, `1M`.
    - minimum allowed interval is `1m` (no sub-minute values in V1).
    - V1 default cadence profile by plan:
      - `FREE`: market scan `5m`, position scan `5m`.
      - `ADVANCED`: market scan `1h`, position scan `1h`.
      - `PROFESSIONAL`: market scan `1m`, position scan `1m`.
    - `free` plan allows only low-load cadence options: `5m` (default) and `15m`.
    - cadence selector UX uses that same global interval list for all plans; unavailable values are visible but disabled by entitlement.
    - in `free`, only low-load options are enabled (`5m`, `15m`); remaining options stay visible but disabled.
    - entitlement mapping for editable plans:
      - `ADVANCED`: enabled `1m`, `5m`, `15m`, `30m`, `1h` (with `1h` default).
      - `PROFESSIONAL`: enabled full global interval catalog (with `1m` default).
    - these are default plan baselines and may be tuned from admin controls if production load data requires adjustment.

## Documentation Parity Governance
- Decision state: resolved on 2026-04-12.
- Decision:
  - canonical documentation must stay execution-ready for both humans and agents.
  - any change in module inventory (`apps/api/src/modules/*`, `apps/web/src/features/*`) or route inventory (`apps/web/src/app/**/page.tsx`) must include same-change updates in canonical docs.
  - delivery model remains tiny-commit documentation waves with explicit queue items in `mvp-next-commits.md`.
- Locked behavior:
  - maintain module inventory in `docs/modules/system-modules.md`.
  - maintain route inventory in `docs/architecture/dashboard-route-map.md`.
  - maintain active documentation queue in `docs/planning/mvp-next-commits.md`.
  - run and publish periodic parity audit artifacts in `docs/modules/`.
- Canonical references:
  - `docs/planning/documentation-knowledge-hardening-plan-2026-04-12.md`
  - `docs/modules/documentation-coverage-audit-2026-04-12.md`

## Deployment Topology and Domain Split (DEV/STAGE/PROD)
- Decision state: resolved on 2026-04-02.
- Deployment direction:
  - keep explicit mode split: `DEV` (local watch flow), `STAGE` (VPS test gate), and `PROD` (user-facing runtime).
  - for production runtime, treat workers as separate process ownership from API service.
  - preferred VPS topology on Coolify:
    - stage stack: `stage-web`, `stage-api`, `stage-workers`, `stage-postgres`, `stage-redis`,
    - prod stack: `web`, `api`, `workers`, `postgres`, `redis`.
  - canonical domain split for current rollout:
    - web: `cryptosparrow.luckysparrow.ch`,
    - api: `api.cryptosparrow.luckysparrow.ch`.
  - stage should use separate stage hostnames and isolated data stores.
  - exchange API keys are optional in baseline env setup and required only when testing LIVE exchange paths.
- Canonical reference:
  - `docs/planning/deployment-dev-prod-coolify-plan-2026-04-02.md`

## Commit Promotion Policy (Automatic Update)
- Decision state: resolved on 2026-04-03.
- Decision:
  - immutable commit SHA promotion flow (`STAGE` gate pack -> `PROD`) remains canonical.
  - branch strategy is operationally locked by deployment pipeline contracts and does not require additional planning decision.
- Locked behavior:
  - immutable commit SHA promotion path:
    - local change and push,
    - automatic deploy to `STAGE`,
    - gate pack pass (`build/test/migrate/health/smoke`),
    - automatic promotion of same SHA to `PROD`.
  - failed stage gate blocks production rollout.
  - failed post-deploy production health triggers automatic rollback to previous stable release.
- Canonical references:
  - `docs/planning/deployment-dev-prod-coolify-plan-2026-04-02.md`
  - `docs/planning/mvp-execution-plan.md` (`Phase 25`, tasks `DPL-13..DPL-20`)

## Global Brand Rename (`CryptoSparrow` -> `Soar`)
- Decision state: resolved on 2026-04-03.
- Decision:
  - execute phased rollout with explicit rollback points (`docs`, `UI copy`, `assets`, `operations`, then infra/domain follow-up).
- Locked behavior:
  - perform audit-first phased rollout with explicit rollback points.
  - do not block deployment-simplicity track on rename completion.
  - preserve existing domains during deployment hardening; domain rename/redirect policy is separate follow-up.
- Canonical references:
  - `docs/planning/deployment-dev-prod-coolify-plan-2026-04-02.md`
  - `docs/planning/mvp-execution-plan.md` (`Phase 25`, tasks `DPL-11`, `DPL-12`)

## Product North Star (Autonomous Agent Trajectory)
- Decision state: resolved on 2026-03-22.
- Product direction:
  - evolve from strategy tooling into autonomous trading-agent platform in phased manner.
  - target optimization is risk-adjusted decision quality and execution consistency, not guaranteed returns.
  - autonomy grows in stages: analytics -> assistant -> semi-auto -> autonomous mandate -> network intelligence.
  - system should combine global aggregated intelligence with per-user private execution profile.
  - aggregate learning must use statistical effectiveness patterns, never direct user behavior copying.
  - "do not trade" must remain valid output when no edge is detected.
- Canonical reference:
  - `docs/product/autonomous-agent-vision.md`

## Dashboard vs Bots Information Architecture Split
- Decision state: resolved on 2026-03-31.
- Scope: operator UX for runtime bot workflows.
- Decision:
  - `Dashboard` remains the global control-center surface for application-level status and quick navigation.
  - `Bots` module is the runtime operations center for bot execution context and monitoring.
  - Bots monitoring must be organized into explicit temporal operator blocks:
    - `Now` (open positions, open orders, current exposure),
    - `History` (closed positions, trades, realized outcomes),
    - `Future` (live signal-check status for tracked symbols).
  - UI work in this track must not introduce runtime-logic drift; backend changes are allowed only when required to support operator clarity and consistency.
- Implementation rollout:
  - `Phase 19` (`BOPS-01..BOPS-09`) in `docs/planning/mvp-execution-plan.md`.

## Lifecycle Close Authority (Parity Contract)
- Decision state: resolved on 2026-03-29.
- Scope: backtest, paper, and live runtime equivalence.
- Decision:
  - strategy evaluation can produce `EXIT` as analytical trace context,
  - but direct strategy `EXIT` must not close an already open position in parity mode,
  - open positions are closed only by lifecycle manager reasons:
    - `TP`, `TTP`, `SL`, `TSL`, `LIQUIDATION` (plus account-floor protection),
  - lifecycle order remains canonical:
    - `DCA -> (basic: TP->SL | advanced: TTP->TSL) -> liquidation/floor`.
- Implementation rollout:
  - `Phase 17` (`POS-36..POS-42`) in `docs/planning/mvp-execution-plan.md`.

## Strategy Schema (MVP)
- Decision state: resolved on 2026-03-15.
- MVP schema is frozen as:

```json
{
  "version": "1.0",
  "name": "string",
  "enabled": true,
  "entry": {
    "logic": "AND",
    "rules": [
      {
        "indicator": "string",
        "timeframe": "string",
        "operator": "string",
        "value": 0
      }
    ]
  },
  "exit": {
    "logic": "OR",
    "rules": [
      {
        "indicator": "string",
        "timeframe": "string",
        "operator": "string",
        "value": 0
      }
    ]
  },
  "risk": {
    "positionSizing": {
      "mode": "fixed_amount",
      "value": 0
    },
    "leverage": 1,
    "stopLoss": {
      "type": "percent",
      "value": 0
    },
    "takeProfit": {
      "type": "percent",
      "value": 0
    },
    "trailingStop": {
      "enabled": false,
      "type": "percent",
      "value": 0
    },
    "dca": {
      "enabled": false,
      "maxAdds": 0,
      "stepPercent": 0
    },
    "maxOpenPositions": 1
  },
  "filters": {
    "symbols": {
      "mode": "all",
      "whitelist": [],
      "blacklist": []
    },
    "excludeStablePairs": true,
    "minVolume24h": 0
  },
  "timeframes": ["1m", "5m", "15m"]
}
```

- Notes:
  - Nested groups beyond top-level `logic` + flat `rules` are out of MVP scope.
  - Import/export versioning stays at `1.0` for MVP and can evolve after MVP.

## Rule Nesting Depth
- Decision state: resolved on 2026-03-15.
- MVP decision:
  - Rule nesting depth beyond top-level `logic` + flat `rules` arrays is explicitly out of scope.
  - MVP supports only one condition-group level per `entry` and `exit`.
  - Nested trees and recursive groups are deferred to post-MVP.

## Preset Storage Format
- Decision state: resolved on 2026-03-15.
- MVP decision: keep presets code-defined (server-side templates in source control), not DB-stored.
- Scope for MVP:
  - Presets are read-only and versioned with application code.
  - No user CRUD for presets in MVP.
  - Preset selection is exposed via API as predefined options.
- Post-MVP migration trigger:
  - move presets to DB when user-defined sharing, version history, or per-tenant customization is required.

## Backend Architecture Style
- Decision state: resolved on 2026-03-20.
- MVP decision:
  - build backend as a modular monolith (clear bounded modules in one deployable service).
  - keep module boundaries extraction-ready to allow gradual migration to microservices post-MVP.
- Post-MVP migration trigger:
  - extract selected modules into microservices only when scaling, team autonomy, or isolation needs justify added operational complexity.

## Backend Framework (Express vs Nest)
- Decision state: resolved on 2026-03-20.
- V1 decision:
  - keep backend on Express (no Nest migration before V1 release).
  - continue improving modular boundaries, contracts, and test coverage on current Express codebase.
- Post-V1 rule:
  - keep Express by default if delivery and maintainability remain healthy.
- evaluate Nest migration only if clear pain appears (team velocity, maintainability, module ownership, framework-level needs).

## LIVE Fee Source-of-Truth Contract
- Decision state: resolved on 2026-04-04.
- Decision:
  - use non-blocking execution continuity with `feePending` and deterministic reconciliation retry path.
  - exchange fills/trades are canonical fee source once available.
- Locked behavior:
  - prefer non-blocking execution continuity (`feePending`) with deterministic retry/reconciliation,
  - use exchange fills/trades as canonical fee source once available,
  - estimator-derived fee allowed only as temporary placeholder in LIVE and must be traceable via `feeSource`.

## Runtime Execution Idempotency (OPEN/DCA/CLOSE/CANCEL)
- Decision state: resolved on 2026-04-04.
- Product/runtime decision:
  - all side-effecting runtime execution commands must use deterministic dedupe keys and replay-safe semantics,
  - command contract is frozen for `OPEN`, `DCA`, `CLOSE`, and `CANCEL`,
  - persistence-based dedupe is required for restart/crash safety (in-memory dedupe alone is not sufficient for production correctness),
  - replayed intents must resolve to `reuse/no-op` instead of duplicated external side effects.
- Canonical reference:
  - `docs/architecture/runtime-execution-idempotency-contract.md`

## Dashboard Trade-History Financial Semantics
- Decision state: resolved on 2026-04-04.
- Product/UI decision:
  - trade-history financial display is action-gated,
  - `OPEN` and `DCA` rows render `Realized PnL` as blank (`"-"`),
  - `CLOSE` rows render realized payload value (including explicit zero),
  - `Margin` is canonical capital column for Dashboard and Bots history parity.
- Canonical reference:
  - `docs/architecture/dashboard-trade-history-financial-semantics-contract.md`

## App-Shell Template Split (Public / Dashboard / Admin)
- Decision state: resolved on 2026-04-04.
- Product/IA decision:
  - frontend shells are explicitly split into three route-scoped templates: `public`, `dashboard`, `admin`,
  - `/dashboard/*` and `/admin/*` remain isolated surfaces with separate navigation trees and layout ownership,
  - `/admin/*` requires strict admin authorization (not dashboard-level auth only),
  - shared primitives (branding/theme/locale behavior) stay reusable across shells without collapsing shell boundaries.
- Canonical reference:
  - `docs/architecture/app-shell-template-split-contract.md`

## Exchange Placeholder Policy (Post-Binance Expansion)
- Decision state: resolved on 2026-04-04.
- Product/runtime decision:
  - during placeholder expansion, `BYBIT/OKX/KRAKEN/COINBASE` are selectable context values but not live-enabled adapters,
  - all unsupported exchange paths must fail closed with explicit error contract (`EXCHANGE_NOT_IMPLEMENTED`),
  - no silent fallback to `BINANCE` when a non-Binance exchange is selected,
  - default exchange remains `BINANCE` until each adapter reaches production-ready parity.
- Canonical reference:
  - `docs/planning/exchange-placeholder-adapters-plan-2026-04-04.md`

## MarketUniverse Venue-Context Ownership
- Decision state: resolved on 2026-04-06.
- Product/runtime decision:
  - `MarketUniverse` is canonical source-of-truth owner for venue context (`exchange`, `marketType`, `baseCurrency`).
  - `SymbolGroup`, `BacktestRun`, and `Bot` contexts are derived/inherited from selected universe context and must not drift.
  - runtime stream processing and execution account selection must enforce context match (`exchange + marketType`) and fail closed on mismatch.
  - creator-side optional context filters can narrow selectable groups but never override canonical context ownership.
- Canonical references:
  - `docs/architecture/venue-context-source-of-truth-contract.md`
  - `docs/planning/exchange-context-consistency-plan-2026-04-01.md`

## Wallet Source-of-Truth and Wallet-First Bot Contract
- Decision state: resolved on 2026-04-16.
- Product/runtime decision:
  - `Wallet` is canonical source-of-truth for bot execution mode and capital budgeting context.
  - shared wallet is allowed (`many bots -> one wallet`).
  - bot create/edit contract is wallet-first (`walletId`); direct mode selection in bot form is not canonical.
  - backtests stay wallet-independent and keep explicit `initialBalance`.
  - insufficient wallet budget is hard-fail (reject order; no auto-clamp).
  - wallet context must be compatible with selected bot market context (`exchange`, `marketType`, `baseCurrency`).
- Dashboard IA decision:
  - wallet module is first-class and must be placed between `Exchanges` and `Markets` in canonical dashboard navigation contract.
- Canonical references:
  - `docs/architecture/wallet-source-of-truth-contract.md`
  - `docs/planning/wallet-module-implementation-plan-2026-04-07.md`

## Numeric Locale Input Policy (Comma vs Dot)
- Decision state: resolved on 2026-04-02.
- Decision:
  - UI accepts both separators (`.` and `,`) and normalizes to canonical decimal values.
- Locked behavior:
  - UI accepts both separators and normalizes to canonical decimal value,
  - parser enforces precision/range with explicit validation errors,
  - integer and decimal field classes are validated separately by policy matrix.

## Runtime Optimization Feature-Flag Matrix (CPU/DB Wave)
- Decision state: resolved on 2026-04-16.
- Decision:
  - CPU/DB runtime optimization rollout is flag-first and reversible.
  - each optimization slice must ship with explicit enable/disable control before broad activation.
- Locked flag matrix (default values):
  - `RUNTIME_TOPOLOGY_CACHE_ENABLED=true`
    - scope: runtime active-bot topology cache read path.
  - `RUNTIME_TELEMETRY_THROTTLE_ENABLED=true`
    - scope: session heartbeat write throttling and symbol-stats batching paths.
  - `WEB_RUNTIME_ADAPTIVE_POLLING_ENABLED=true`
    - scope: dashboard/bots adaptive polling cadence.
  - `WEB_RUNTIME_SSE_PREFERRED_ENABLED=true`
    - scope: SSE-first runtime stats refresh with polling fallback.
- Rollout contract:
  - each flag can be disabled independently without cross-module code rollback.
  - production rollout order remains: `stage canary -> production partial -> production full`.
  - rollback contract is fail-safe: disable affected flag first, then investigate root cause.

## CPU/DB Runtime Alert Thresholds and Dashboard Contract
- Decision state: resolved on 2026-04-16.
- Decision:
  - CPU/DB rollout gates require explicit alert thresholds for latency, DB pressure, runtime lag, and restart bursts.
  - operator dashboards must expose those signals in one canary-ready view before full rollout.
- Threshold matrix:

| Signal | Source | Warning threshold | Critical threshold |
| --- | --- | --- | --- |
| API latency p95 | edge/APM gateway latency percentile for `/dashboard/*` + `/workers/runtime-freshness` probes | >= 350ms for 10m | >= 600ms for 5m |
| DB QPS (read+write) | managed Postgres telemetry (provider-level query throughput) | >= 120 qps for 10m | >= 180 qps for 5m |
| Runtime event lag | `GET /metrics` -> `runtime.signalLag.lastMs` (`runtime_signal_lag_stale`) | >= 90,000ms for 3 consecutive checks | >= 180,000ms for 3 consecutive checks |
| Runtime restart burst | `GET /metrics` -> `runtime.restarts.total` delta + `/alerts` (`runtime_restarts_repeated`) | >= 3 restarts in 30m | >= 6 restarts in 30m |

- Dashboard contract (minimum panels):
  - `CPU/DB Canary Gate`:
    - API latency p95 trend,
    - runtime signal lag (`lastMs`, `avgLagMs`, `maxMs`),
    - runtime restart delta (`runtime.restarts.total` over 30m),
    - active rollback-critical alerts count (`/alerts`).
  - `CPU/DB Database Pressure`:
    - DB QPS (read+write),
    - runtime hot-path write proxies (`runtime.hotPath.touchSessionWrites`, `runtime.hotPath.symbolStatsWrites`),
    - execution queue lag (`worker.queueLag.execution`) as pressure correlation signal.
- Fallback policy:
  - if p95 or DB QPS is unavailable in local `/metrics`, use provider/APM dashboards as canonical source for those two thresholds.
  - rollout is blocked when any critical threshold is breached until rollback/mitigation clears the signal.

## Worker Split Timing
- Decision state: resolved on 2026-04-17.
- Decision:
  - `PROD`: API and workers are mandatory split-process services (no shared-process fallback in normal operation).
  - `STAGE/DEV`: split API and workers when any trigger below is met.
- Trigger contract for `STAGE/DEV` split:
  - execution queue lag pressure:
    - `worker.queueLag.execution` p95 `> 10` for `>= 15 minutes`, or
    - `worker.queueLag.execution` max `> 20` for `>= 5 minutes`.
  - API latency with queue coupling:
    - API p95 `>= 350ms` for `>= 10 minutes` with simultaneous execution queue lag p95 `> 10`.
  - restart instability:
    - runtime restart burst reaches critical threshold (`>= 6 restarts / 30 minutes`) and queue lag does not recover to `<= 10` within 10 minutes.
- Escalation policy:
  - when any trigger is met, promote split-process topology before further runtime feature rollout.
  - if already split and trigger persists, treat as incident and execute runtime triage/rollback playbooks.
- Canonical references:
  - `docs/planning/deployment-dev-prod-coolify-plan-2026-04-02.md`
  - `docs/operations/v1-slo-catalog.md`
  - `docs/operations/runtime-incident-triage-matrix.md`

## Stream Transport to Frontend
- Decision state: resolved on 2026-03-19.
- MVP decision: use `SSE` for market stream fan-out to dashboard clients.
- Contract: see `docs/architecture/stream-transport-contract.md`.
- Post-MVP path: keep upgrade path to app-level WebSocket gateway for bidirectional scenarios.

## API Query Model (REST vs GraphQL)
- Decision state: resolved on 2026-03-20.
- V1 decision:
  - keep API as REST + SSE.
  - do not introduce GraphQL before V1 release.
- V2 evaluation rule:
  - evaluate GraphQL only if measurable backend/resource optimization is expected on target production workloads.

## Exchange Coverage (V1 -> V2)
- Decision state: resolved on 2026-03-20.
- V1 decision:
  - production exchange support is limited to Binance Spot and Binance Futures.
  - no additional exchanges in V1 scope.
- V2 direction:
  - expand exchange coverage by implementing new adapters on top of the Binance adapter pattern.

## Coin Icon Source Policy (Dashboard/UI Assets)
- Decision state: resolved on 2026-04-05.
- Product/ops decision:
  - coin/token icons for UI should use CoinGecko as the primary external source (symbol/id mapped catalog),
  - do not depend on exchange-provided icon catalogs as canonical source for app UI,
  - fail-soft fallback chain is required: `CoinGecko -> local curated symbol map -> generic placeholder icon`,
  - icon lookup must be cache-backed (TTL) to reduce rate-limit pressure and keep dashboard rendering stable during upstream API issues.
- Deployment assumptions:
  - prefer configured CoinGecko API key when available; keep non-key fallback path for local/dev environments,
  - expose env-driven controls for API base URL, API key, and cache TTL to support stage/prod tuning without code edits.
- Implementation rollout:
  - `docs/planning/mvp-execution-plan.md` (`Phase 32`, tasks `ICN-01..ICN-07`)
  - `docs/planning/coin-icons-coingecko-plan-2026-04-05.md`
  - `docs/architecture/coin-icon-source-contract.md`

## Mode Entry Policy (PAPER vs LIVE)
- Decision state: resolved on 2026-03-20.
- V1 decision:
  - user chooses execution mode through selected wallet (`wallet.mode`) in bot create/edit flow.
  - newly created wallets should default to `PAPER`; bots inherit mode from wallet.
  - PAPER mode does not require risk-consent acceptance.
  - LIVE mode requires explicit risk-consent acceptance before activation.
- UX/ops guidance:
  - PAPER-before-LIVE remains strongly recommended but is not a hard technical gate for wallet activation.

## Runtime Domain Model (Bot vs Strategy)
- Decision state: resolved on 2026-03-20.
- V1 decision:
  - keep `Bot` as the primary runtime entity (execution lifecycle, mode, exchange/account binding, runtime state).
  - allow multiple strategies per bot.
  - cardinality clarification: bot-to-symbol-group mapping is many-to-many through BotStrategy; symbol-group-to-BotStrategy is one-to-many.
  - BotStrategy is the runtime binding unit (`bot + symbolGroup + strategy`) and should be treated as first-class execution scope.
  - do not enforce a per-bot strategy count limit in V1.
  - allow multiple bots per user.
- Limits policy:
  - max bots per user is controlled by subscription plan.
  - bot limits are tracked per mode pool (`PAPER` and `LIVE`) instead of one combined total pool.
  - global account-level safety limits remain enforced (for example max open positions).
- Architecture direction:
  - do not hide bot as only an internal implementation detail in V1; keep it explicit across API, UI, and operations.

## AI Assistant Topology
- Decision state: resolved on 2026-03-22.
- V1 direction:
  - user can own multiple AI assistants with isolated configuration and audit trail.
  - runtime target topology is one main assistant with up to four subagents per bot context.
  - assistant outputs are advisory/execution-scoped only inside explicit mandate and risk policy constraints.

## Canonical Multi-Bot Runtime Model (User -> Bot -> Market Group -> Strategy)
- Decision state: resolved on 2026-03-23.
- Canonical model for Phase 12 (`MBA-02`):
  - one user can own many bots.
  - one bot can own many bot-scoped market groups.
  - one bot market-group can reference many strategies.
  - one strategy can be reused in many bot market-groups (by links).
- Runtime entity hierarchy:
  - `User (1) -> Bot (N) -> BotMarketGroup (N) -> MarketGroupStrategyLink (N) -> Strategy (1)`.
- Invariants:
  - ownership isolation: every child entity must belong to the same user as parent bot.
  - deterministic execution ordering at group level (`executionOrder`).
  - deterministic strategy ordering in group (`priority`, `weight`, stable tie-break).
  - one symbol, one active direction at a time (no-flip).
  - external/manual positions are ignored unless explicitly delegated to bot management.
- Assistant topology binding:
  - assistant stack is bot-scoped: `1 main + up to 4 subagents` per bot.
  - assistant stack influences decisions only inside bot mandate and risk policy.
  - fail-closed rule: assistant timeout/error degrades to strategy-only path (no unsafe action escalation).

## Deterministic Signal Merge Policy
- Decision state: resolved on 2026-03-23.
- Merge contract:
  - strategy outputs are merged per `(bot, market-group, symbol, interval-window)`.
  - action domain: `LONG | SHORT | EXIT | NO_TRADE`.
  - guardrails run first (kill switch, manual-managed ignore, no-flip, risk caps).
  - `EXIT` has highest priority when at least one enabled strategy emits it.
  - directional votes use weighted score (`priority` + `weight`) with deterministic tie-break.
  - unresolved/tie/weak-consensus result is always `NO_TRADE`.
- Canonical technical spec:
  - `docs/architecture/runtime-signal-merge-contract.md`

## Subscription and Admin Controls (V1 -> V2)
- Decision state: resolved on 2026-03-20.
- 2026-04-06 refinement (active implementation track):
  - canonical tier catalog is now `FREE`, `ADVANCED`, `PROFESSIONAL`.
  - registration default remains `FREE` for every new account.
  - owner bootstrap override is required for `wroblewskipatryk@gmail.com` -> `PROFESSIONAL`.
  - previous tier naming containing `simple` is treated as legacy terminology and should be migrated to current catalog before release.
  - payment provider is intentionally undecided at decision level; implementation should use provider-agnostic gateway abstraction with Stripe as first adapter candidate.
  - canonical contract reference: `docs/architecture/subscription-tier-entitlements-contract.md`.
- V1 decision:
  - include an admin panel in V1 for critical business controls (plan pricing, bot limits, mode entitlements, sensitive app settings).
  - keep public and authenticated user dashboard separated from admin surface.
  - launch with default plan presets:
    - `FREE`: max 1 bot, PAPER only, max 1 strategy per bot, backtest history limited to last 30 days, max 1 concurrent backtest job.
      - seed split: `LIVE=0`, `PAPER=1`.
      - no LIVE entitlement and no temporary LIVE trial in V1.
    - `ADVANCED`: max 3 bots, PAPER + LIVE.
      - seed split: `LIVE=3`, `PAPER=3`.
      - all 3 seed LIVE bots may run concurrently when risk-consent and account safety checks pass.
      - backtest concurrency is limited (max 3 concurrent backtest jobs).
    - `PROFESSIONAL`: max 10 bots, PAPER + LIVE.
      - seed split: `LIVE=10`, `PAPER=10`.
      - all 10 seed LIVE bots may run concurrently when risk-consent and account safety checks pass.
      - backtest concurrency limit: max 10 concurrent backtest jobs.
- Product rule:
  - all product capabilities should stay visible in UI across plans; entitlement controls usage (locked state), not feature discoverability.
  - bot-cap enforcement applies at creation time: when plan/mode pool limit is reached, creating new bots (including draft/non-active bots) is blocked.
  - existing inactive bots already created before reaching or after later limit reductions remain visible/manageable (edit/delete), but do not grant extra creation capacity.
  - when bot-creation cap is reached, `Create bot` remains visible in disabled state with tooltip/helper context and one-plan `Upgrade to ...` CTA (no control hiding).
  - defaults are seed values; effective limits are managed from admin panel (no code deploy required for routine adjustments).
  - for `ADVANCED`, `PAPER` and `LIVE` bot caps are configured independently by admin; seed defaults are `PAPER=3`, `LIVE=3`.
  - for `PROFESSIONAL`, `PAPER` and `LIVE` bot caps are configured independently by admin; seed defaults are `PAPER=10`, `LIVE=10`.
  - for `FREE`, `PAPER` and `LIVE` bot caps are configured independently by admin; seed defaults are `PAPER=1`, `LIVE=0`.
  - upgrade to a higher plan is immediate after paying only the price difference for the current billing period.
  - entitlement changes after successful upgrade payment must apply immediately in current user session (no forced logout/login).
  - failed upgrade payment must not change plan state or entitlements (no partial activation).
  - payment abuse guard: after 3 consecutive failed payment attempts, apply temporary checkout cooldown in V1 (default: 15 minutes) before next attempt is allowed.
  - anti-abuse counters and cooldowns in V1 should be keyed by composite `user + IP` context where user identity is available.
  - apply analogous anti-abuse controls to authentication and high-risk denied request patterns (for example repeated unauthorized/forbidden access attempts), with temporary cooldown/lock behavior and security logging.
  - for repeated failed logins, enforce escalating lock windows on both account and source IP in parallel.
  - baseline escalation profile for V1:
    - 3 failed attempts: 5-minute lock.
    - 5 failed attempts: 15-minute lock.
    - 10 failed attempts: 4-hour lock.
  - send security email notification already at the first lock threshold; message must include current lock reason and clear warning about stronger lock durations for further failed attempts.
  - locked users should have self-service recovery flow: after passing control questions generated from account data, lock is lifted automatically without admin intervention.
  - admin must retain emergency override powers to unlock user/account/IP locks and handle abuse incidents.
  - admin is allowed to manually assign subscription plan and validity period for selected accounts (for example complimentary/internal access without checkout).
  - admin manual grants must support both activation modes: immediate start (`now`) and scheduled start at a future date/time.
  - when scheduled manual grant starts, it temporarily overrides currently active subscription plan for grant duration.
  - manual admin subscription grants must set `auto-renew` to `OFF` by default.
  - after manual grant expires, account should return to the previous plan state that existed before grant activation (not forced fallback to `free` unless it was the previous state).
  - when returning to previous paid plan after grant expiry, original billing renewal date/cycle is preserved (no rebasing of billing anchor date).
  - account plan UI should always present currently active plan as primary status; active grant is shown as additional contextual info (not as separate primary plan state).
  - grant info visibility rule: always show in subscription section; additionally show as compact global dashboard badge when layout space and readability allow.
  - user cannot terminate active manual grant early in V1; grant remains active until configured end timestamp.
  - admin can terminate active grant early when required (for example abuse response, policy enforcement, operational correction).
  - manual grant termination by admin requires mandatory reason field stored in audit trail.
  - reason description field length in V1: min 10, max 500 characters.
  - reason category and reason description for grant/security admin actions are English-only in V1.
  - when admin ends grant early, user receives email notification with reason category + reason description and effective end timestamp.
  - reason category must be selected from predefined controlled list (enum), not free-text category input.
  - category catalog is stable by default, but admin may append new categories when operationally needed.
  - baseline categories should not be edited/renamed in place in V1 to preserve reporting/audit consistency.
  - newly added categories become active immediately for global use (no draft/publish lifecycle in V1).
  - category removal in V1 uses soft-delete semantics (category is hidden for new use, historical references remain intact).
  - soft-deleted categories can be reactivated by admin when needed.
  - category reactivation takes effect immediately and is globally visible in admin forms without delayed publish step.
  - exact thresholds and durations should remain configurable for security hardening without code changes.
  - downgrade to a lower plan is deferred until current paid period ends (no early feature cutoff).
  - billing cadence for V1 is monthly-only.
  - annual billing is explicitly deferred to V2.
  - checkout in V1 uses one primary payment flow (no multi-path checkout variants).
  - checkout in V1 is available only for authenticated users (no guest checkout path).
  - each user account can have only one active subscription plan at a time in V1.
  - payment-method expansion (fiat + crypto) is deferred to V2.
  - gift-card style purchase flows are out of V1 scope; evaluate in V2.
  - invoice/receipt document is generated automatically after each successful payment, must be downloadable from user panel, and confirmation with document link/attachment is sent by email.
  - payment document language in V1 is English-only.
  - in V2, support English original plus localized user-language rendering when supported by selected payment gateway/tooling.
  - billing profile data updates affect only future documents; previously issued documents are immutable.
  - billing profile data is not required during account registration in V1.
  - billing profile is required just-in-time at the first payment attempt (or earlier if user voluntarily completes it in account settings).
  - no recurring nag reminders are sent for missing billing profile when user is not trying to pay.
  - if checkout is interrupted due to missing billing profile, the system should preserve checkout intent and resume user to the same checkout context immediately after profile completion.
  - billing-data forms in V1 must enforce only general validation of required legal fields and basic format checks (for example email format, country presence, postal-code shape, field lengths).
  - country-specific tax-ID/VAT validation is out of V1 scope and may be added in V2 depending on gateway/regulatory needs.
  - billing identity data is user-declared; platform validates format and completeness, not factual correctness of identity claims.
  - subscriptions use auto-renew by default in V1 (user can disable renewal from account settings).
  - payment reminders are required before renewal date and during failed-payment window.
  - on unpaid expiration, platform enters non-served mode for paid runtime features: no automated bot decisions or LIVE actions are executed (including open/close management flows handled by app runtime).
  - on unpaid expiration, bot runtime switch is forced to `OFF` to prevent implicit restarts.
  - after subscription reactivation, user must manually switch bots back `ON`; no automatic resume.
  - on successful reactivation, send one reminder notification if user has bots in `OFF` state due to expiry, prompting manual re-enable.
  - subscription-loss communication should be centralized (account notification/inbox), not repeated across multiple dashboard areas.
  - send one centralized subscription-loss notification at T+1 minute after subscription expiry event (single event notification, no repeated spam loop).
  - in `PAST_DUE`, dashboard access remains available for history review and settings management; only paid runtime actions are blocked.
  - disabled LIVE actions should include concise contextual helper text (for example: "Oplac subskrypcje, aby ponownie wlaczyc LIVE"), without duplicating full billing banners.
  - locked feature CTA pattern must include exactly one target plan hint: the lowest plan above current tier that unlocks the feature (for example: `Upgrade to: Advanced`; if not enough, `Upgrade to: Professional`).
  - CSV history export is available in active and `PAST_DUE` states with plan-based max export window:
    - `FREE`: up to last 3 months.
    - `ADVANCED`: up to last 6 months.
    - `PROFESSIONAL`: up to last 12 months.
  - CSV export request rate limit: default max 1 export per user per 10 minutes.
  - admin can tune this cooldown based on observed average report generation time and infrastructure load.
- V2 direction:
  - extend admin with richer billing/analytics/experimentation workflows beyond V1 critical controls.

## Portuguese Locale Variant Policy
- Decision state: resolved on 2026-04-17.
- Decision:
  - add one Portuguese locale variant for V1 localization expansion: `pt` mapped to `pt-PT`.
  - explicitly exclude `pt-BR` from this rollout.
  - EN remains default locale; PL remains fully supported.
- Locked behavior:
  - language switcher must expose `en`, `pl`, and `pt`.
  - selecting Portuguese sets HTML lang to `pt` and formatting contract to `pt-PT`.
  - no parallel Brazil-specific copy branch should be introduced in this wave.
- Canonical reference:
  - `docs/planning/pt-pt-localization-rollout-plan-2026-04-17.md`

## L10NQ Scope and Documentation Language Baseline
- Decision state: resolved on 2026-04-17.
- Decision:
  - execute localization remediation in three scoped waves:
    - `L10NQ-A` (`L10NQ-01..L10NQ-05`): P0 blockers (locale clamps + hardcoded-copy hotspots),
    - `L10NQ-B` (`L10NQ-06..L10NQ-11`): namespace structure + parity/guardrail tests,
    - `L10NQ-C` (`L10NQ-12..L10NQ-15`): route-level loading + docs normalization.
  - freeze active runtime localization contract to three locales only: `en`, `pl`, `pt` (`pt-PT` formatting).
  - canonical product/governance/QA documentation language is English by default.
  - non-English docs may remain temporarily as legacy backlog, but new canonical docs must be authored in English.
- Locked behavior:
  - no new EN/PL locale clamp may be introduced in production code paths.
  - hardcoded user-facing wrapper/module copy must be migrated to locale-aware contract before wave closure.
  - remediation status is tracked only through canonical planning files (`mvp-next-commits`, `mvp-execution-plan`).
- Canonical references:
  - `docs/planning/i18n-contract-remediation-plan-2026-04-17.md`
  - `docs/planning/mvp-next-commits.md`
  - `docs/planning/mvp-execution-plan.md`

## Accessibility Scope
- Decision state: resolved on 2026-04-17.
- Decision:
  - keep MVP/V1 baseline accessibility as already delivered.
  - execute a structured post-MVP full accessibility pass through tiny-commit wave `A11Y`.
  - lock execution timeline and closure gates in canonical plan.
- Canonical reference:
  - `docs/planning/accessibility-full-pass-plan-2026-04-17.md`

## Runtime Position Governance (BACKTEST/PAPER/LIVE)
- Decision state: resolved on 2026-03-22.
- V1 decision:
  - one-way behavior per symbol: only one active direction at a time (`LONG` or `SHORT`), no automatic flip.
  - if position on symbol is already open, opposite-side entry signal is ignored until current position is closed.
  - live exchange state is runtime source-of-truth; DB is synchronized operational projection and analytics source.
  - manually opened exchange positions are synchronized only when API-key sync option is enabled.
  - synchronized external positions default to `MANUAL_MANAGED` (not controlled by bot rules).
  - user can manually switch position management mode to `BOT_MANAGED`.
  - when symbol is occupied by manually managed position, bot entry signal for that symbol is ignored.

## Dashboard Positions/Orders Ownership and Visibility Matrix
- Decision state: resolved on 2026-04-17.
- Decision:
  - dashboard runtime tab contract is frozen as `positions`, `orders`, `history`.
  - `positions` tab for selected bot shows only `BOT_MANAGED` rows in bot runtime scope:
    - directly owned rows (`position.botId === botId`),
    - external takeover rows (`origin=EXCHANGE_SYNC`, `botId=null`) only when deterministic symbol-owner mapping resolves to selected bot.
  - deterministic symbol-owner mapping order is frozen:
    - active bot first,
    - lower `executionOrder` first,
    - earlier bot `createdAt` first,
    - lexical bot id as final tie-break.
  - close-position action is fail-closed:
    - actionable only for `OPEN + BOT_MANAGED + wallet-compatible` rows owned directly or via deterministic external takeover mapping,
    - non-matching rows must return `status=ignored`, `reason=no_open_position`.
  - external takeover statuses (`UNOWNED`, `AMBIGUOUS`, `MANUAL_ONLY`) remain non-actionable in dashboard close flow.
  - `orders` tab remains visible for both `LIVE` and `PAPER`; empty-state is valid and must not hide the tab.
  - `history` tab remains visible as read-only runtime history surface.
- Canonical references:
  - `docs/planning/dashboard-modules-ux-runtime-fix-wave-plan-2026-04-15.md`
  - `docs/modules/api-bots.md`
  - `docs/modules/web-dashboard-home.md`

## Execution and Backtest Parity Policy
- Decision state: resolved on 2026-03-22.
- V1 direction:
  - backtest, paper, and live must converge to one shared execution core (decision/risk/order lifecycle), with mode-specific adapters.
  - paper mode must be realistic and behaviorally equivalent to live execution path, except for exchange side effects.
  - paper simulation target includes:
    - partial fills,
    - latency model,
    - fee/slippage/funding application,
    - order lifecycle parity with live modes.
  - backtest must simulate the same order and position lifecycle options used by bot runtime (no reduced-rule backtest path).
  - historical market data should be cached in DB and incrementally extended to avoid repeated full refetch from exchange.
  - strategy signal semantics are frozen by one shared contract for all modes.
- Canonical references:
  - `docs/architecture/strategy-evaluation-parity-contract.md`
  - `docs/architecture/position-lifecycle-parity-matrix.md`
  - `docs/architecture/runtime-signal-merge-contract.md`

## Bot Runtime Trigger Policy (Creator/Runtime Alignment)
- Decision state: resolved on 2026-03-30.
- Product decision:
  - bot runtime is websocket-first.
  - strategy signal generation is driven by closed/final candle stream events.
  - open-position lifecycle automation can react to ticker refresh events.
  - interval scan loop is fallback-only watchdog behavior and should be disabled by default in normal operation.
  - no periodic free-running signal-generation loop should be the primary source of bot decisions.
- Canonical references:
  - `docs/architecture/bot-v2-create-update-contract.md`

## Bot Monitoring Surface (Performance Safety)
- Decision state: resolved on 2026-03-30.
- Product decision:
  - bot monitoring view is required, but heavy candlestick chart rendering is explicitly out of scope for this implementation track.
  - monitoring must prioritize lightweight runtime observability:
    - session summary,
    - per-symbol stats,
    - trades/events tables,
    - live refresh of textual/tabular metrics.
  - goal is stable UI performance for multi-pair bots under live data load.
- Canonical references:
  - `docs/architecture/bot-v2-create-update-contract.md`

## Dashboard Isometric Mode Placement
- Decision state: resolved on 2026-03-22.
- V1 decision:
  - remove isometric mode control from active dashboard account menu.
  - treat isometric mode as out-of-scope for current operational UX hardening.
- V2 direction:
  - reintroduce isometric mode as optional gamification layer with explicit UX entry point and feature flag.

## Monorepo App Naming and Mobile Track
- Decision state: resolved on 2026-03-25.
- Product decision:
  - canonical app folders are `apps/web`, `apps/api`, and `apps/mobile`.
  - `apps/mobile` remains bootstrap-only in MVP/V1 and follows incremental parity against web contracts.
  - docs, scripts, and CI references must use `web/api/mobile` naming only (no legacy `client/server` aliases in canonical docs).

## Admin/Billing Scope for V1
- Decision state: resolved on 2026-03-22.
- Product decision:
  - admin + billing are not part of mandatory V1 implementation closure.
  - any unfinished admin/billing promises move to post-MVP / V1.1 track.
  - V1 docs must reflect real delivered scope, without forward-looking features marked as current.

## Routing Canonicalization Policy
- Decision state: resolved on 2026-03-22.
- Product decision:
  - hard-cut policy for dashboard routes: one canonical URL per page, no permanent alias strategy.
  - remove/retire ambiguous route variants (for example `backtest` vs `backtests`) during normalization.
  - docs and menu contracts must reference only canonical routes.

## LIVE Side-Effects Contract
- Decision state: resolved on 2026-03-22.
- Product decision:
  - all three modes are required: `BACKTEST`, `PAPER`, `LIVE`.
  - `BACKTEST` and `PAPER` remain simulation domains and are required quality gates.
  - `LIVE` must execute real exchange side effects (real orders/position state changes on exchange), not local-only simulation.
  - shared decision/risk lifecycle should be reused across modes via adapter separation.

