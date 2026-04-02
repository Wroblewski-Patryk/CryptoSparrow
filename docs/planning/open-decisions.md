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
      - `free`: market scan `5m`, position scan `5m`.
      - `simple`: market scan `1h`, position scan `1h`.
      - `advanced`: market scan `1m`, position scan `1m`.
    - `free` plan allows only low-load cadence options: `5m` (default) and `15m`.
    - cadence selector UX uses that same global interval list for all plans; unavailable values are visible but disabled by entitlement.
    - in `free`, only low-load options are enabled (`5m`, `15m`); remaining options stay visible but disabled.
    - entitlement mapping for editable plans:
      - `simple`: enabled `1m`, `5m`, `15m`, `30m`, `1h` (with `1h` default).
      - `advanced`: enabled full global interval catalog (with `1m` default).
    - these are default plan baselines and may be tuned from admin controls if production load data requires adjustment.

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
- Decision state: open (planned in Phase 21 `LFIN-01..LFIN-05`).
- Open choice:
  - whether LIVE runtime should always block on full fill-fee reconciliation before marking trade final,
  - or allow `feePending` with bounded asynchronous reconciliation window.
- Current planning assumption:
  - prefer non-blocking execution continuity (`feePending`) with deterministic retry/reconciliation,
  - use exchange fills/trades as canonical fee source once available,
  - estimator-derived fee allowed only as temporary placeholder in LIVE and must be traceable via `feeSource`.

## Numeric Locale Input Policy (Comma vs Dot)
- Decision state: open (planned in Phase 21 `LFIN-09..LFIN-11`).
- Open choice:
  - strict dot-only decimal contract (`.`) vs locale-tolerant input (`.` and `,`).
- Current planning assumption:
  - UI accepts both separators and normalizes to canonical decimal value,
  - parser enforces precision/range with explicit validation errors,
  - integer and decimal field classes are validated separately by policy matrix.

## Worker Split Timing
- Open: exact threshold for splitting API and workers into separate processes.
- Current assumption: split when queue lag or API latency exceeds acceptable limits.

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

## Mode Entry Policy (PAPER vs LIVE)
- Decision state: resolved on 2026-03-20.
- V1 decision:
  - user can choose PAPER or LIVE mode directly.
  - newly created bots default to PAPER mode.
  - PAPER mode does not require risk-consent acceptance.
  - LIVE mode requires explicit risk-consent acceptance before activation.
- UX/ops guidance:
  - PAPER-before-LIVE remains strongly recommended but is not a hard technical gate.

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
- V1 decision:
  - include an admin panel in V1 for critical business controls (plan pricing, bot limits, mode entitlements, sensitive app settings).
  - keep public and authenticated user dashboard separated from admin surface.
  - launch with default plan presets:
    - `free`: max 1 bot, PAPER only, max 1 strategy per bot, backtest history limited to last 30 days, max 1 concurrent backtest job.
      - seed split: `LIVE=0`, `PAPER=1`.
      - no LIVE entitlement and no temporary LIVE trial in V1.
    - `simple`: fixed slot model: 1 LIVE bot slot + 1 PAPER bot slot.
      - seed split: `LIVE=1`, `PAPER=1`.
      - no mode-slot substitution in seed model (cannot use the LIVE seed slot as an additional PAPER seed slot).
      - backtest concurrency is limited (max 3 concurrent backtest jobs).
    - `advanced`: max 3 bots, PAPER + LIVE.
      - seed split: `LIVE=3`, `PAPER=3`.
      - all 3 seed LIVE bots may run concurrently when risk-consent and account safety checks pass.
      - backtest concurrency limit: max 10 concurrent backtest jobs.
- Product rule:
  - all product capabilities should stay visible in UI across plans; entitlement controls usage (locked state), not feature discoverability.
  - bot-cap enforcement applies at creation time: when plan/mode pool limit is reached, creating new bots (including draft/non-active bots) is blocked.
  - existing inactive bots already created before reaching or after later limit reductions remain visible/manageable (edit/delete), but do not grant extra creation capacity.
  - when bot-creation cap is reached, `Create bot` remains visible in disabled state with tooltip/helper context and one-plan `Upgrade to ...` CTA (no control hiding).
  - defaults are seed values; effective limits are managed from admin panel (no code deploy required for routine adjustments).
  - for `simple`, `PAPER` and `LIVE` bot caps are configured independently by admin; seed defaults are `PAPER=1`, `LIVE=1`.
  - for `advanced`, `PAPER` and `LIVE` bot caps are configured independently by admin; seed defaults are `PAPER=3`, `LIVE=3`.
  - for `free`, `PAPER` and `LIVE` bot caps are configured independently by admin; seed defaults are `PAPER=1`, `LIVE=0`.
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
  - locked feature CTA pattern must include exactly one target plan hint: the lowest plan above current tier that unlocks the feature (for example: `Upgrade to: Simple`; if not enough, `Upgrade to: Advanced`).
  - CSV history export is available in active and `PAST_DUE` states with plan-based max export window:
    - `free`: up to last 3 months.
    - `simple`: up to last 6 months.
    - `advanced`: up to last 12 months.
  - CSV export request rate limit: default max 1 export per user per 10 minutes.
  - admin can tune this cooldown based on observed average report generation time and infrastructure load.
- V2 direction:
  - extend admin with richer billing/analytics/experimentation workflows beyond V1 critical controls.

## Accessibility Scope
- Open: full accessibility pass timeline.
- Current assumption: baseline accessibility in MVP, full pass after MVP.

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

