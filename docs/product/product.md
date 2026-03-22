# Product Vision (Technical Spec)

## Mission
Build a safe, transparent, and configurable platform for automated crypto trading.

## Audience
Primary target is advanced users who already understand trading concepts and can configure strategies responsibly.

## Core Principles
- Transparency: actions and decisions are traceable.
- Safety: sensitive data is protected and minimized.
- Control: users decide how automation affects real trades.
- Modularity: strategies are reusable building blocks.

## V1 Priority Outcome
- Primary V1 success criterion is reliable 24/7 server runtime replacing legacy local-only bot usage.
- Before broad feature expansion, new app must match core practical utility of existing legacy bot in day-to-day operation.

## V1 Legacy-Parity Minimum (Replacement Gate)
- Strategy configurator must support JSON-based strategy settings as operational source.
- Backtester must be available to validate strategy behavior before runtime usage.
- Bot runtime must detect and manage manually opened Binance Futures and Binance Spot positions.
- Position management automation must cover at least: DCA, SL, TP, TSL until position close.
- Market and position scanning must run in periodic loops with configurable interval and filter-based market scope.
- Preferred implementation is one shared management path controlled by market-type configuration, not separate duplicated logic per market.
- Scan cadence configuration is constrained to predefined allowed interval options (no arbitrary custom interval input).
- Market scan cadence and position-management scan cadence are separate settings.
- Allowed options should be tuned for server safety/performance and not expose abusive frequencies.
- Interval options are tiered by subscription plan so faster cadences are available in higher plans.
- One global V1 interval catalog shared by cadence and indicator/timeframe selectors: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `8h`, `12h`, `1d`, `1w`, `1M` (minimum allowed value is `1m`).
- V1 baseline cadence by plan:
  - `free`: market `5m`, positions `5m`.
  - `simple`: market `1h`, positions `1h`.
  - `advanced`: market `1m`, positions `1m`.
- `free` can choose only low-load options: `5m` (default) or `15m`.
- Cadence picker shows the same interval list for all plans, with unavailable options visible as disabled.
- In `free`, enabled options are exactly `5m` and `15m`; faster values remain visible but disabled.
- `simple` enabled options: `1m`, `5m`, `15m`, `30m`, `1h`.
- `advanced` enabled options: full global interval catalog.
- Baseline values can be tuned from post-MVP admin controls based on observed production load.

## Current Scope (Implemented)
- User authentication and profile basics.
- Strategy CRUD and indicator metadata.
- Markets/Bots/Orders/Positions/Backtests/Logs dashboard pages and API modules.
- Bot management with explicit LIVE opt-in consent guardrails.
- Orders API with read and write-side actions (`open`/`cancel`/`close`) protected by risk acknowledgments.
- Runtime execution orchestrator for `LONG`/`SHORT`/`EXIT` lifecycle (signal -> order -> position).
- Binance market-stream worker with normalized ticker/candle events and MVP SSE transport contract.
- Server-owned market-stream SSE fan-out endpoint (`/dashboard/market-stream/events`) wired from runtime worker events.
- Continuous runtime signal loop (stream ticker -> pre-trade -> signal -> execution orchestration).
- Runtime position automation for SL/TP/trailing/DCA with periodic scan loop support.
- Dashboard live market bar UI (SSE client) with stream health, price delta, and candle freshness indicators.
- Backtest report visuals with equity overlays in summary and modal views.
- API structure with validation, ownership checks, and rate limiting.

## Current Limitations (As of 2026-03-21)
- No full user-facing manual trade panel in dashboard for rich order ticket workflows (current write actions are API-first).
- Production launch evidence for full 24/7 SLO/incident/load gates remains tracked in V1 release tasks (post-MVP launch validation).

## MVP Scope (Target for First Release)
- Strategy builder capable of expressing advanced strategies (indicators, logical conditions, risk rules).
- Strategy presets (trend, mean reversion, breakout).
- Multi-timeframe strategies.
- Multiple entry and exit conditions per strategy.
- Backtester with full trade list and chart overlays for entries and exits.
- Paper trading that mirrors live execution (fees, slippage, order types).
- Live trading on Binance Spot and Binance Futures via API.
- Multi-strategy per account.
- Support for all standard exchange timeframes.
- Multi-user account model with per-user bot/workspace isolation.
- Order types: market, limit, stop, stop-limit, take-profit, trailing.
- Performance reports from backtest data (profit, loss, drawdown, fees, funding).
- Risk controls: max open positions, TP/SL per strategy, trailing, DCA.
- Responsive UI for desktop, tablet, and mobile.
- Internationalization: EN default + PL in MVP.

## Runtime Ownership Model (V1)
- `Bot` is the explicit runtime unit (mode, lifecycle, exchange/account execution context).
- A bot can run multiple strategies.
- A bot can be attached to multiple symbol groups through BotStrategy bindings.
- A symbol group can host multiple strategy bindings for the same bot (distinct BotStrategy rows).
- BotStrategy is the explicit runtime execution scope (`bot + symbol group + strategy`).
- No per-bot strategy cap is enforced in V1.
- A user can run multiple bots.
- Bot-count entitlement is defined by subscription plan.
- Bot-count entitlement is enforced with separate pools for `PAPER` and `LIVE` modes.
- Global account-level risk limits remain enforced independently from per-bot settings.

## AI Assistant Ownership Model (Planned)
- A user can create and operate multiple AI assistants.
- Each assistant has independent mandate, risk profile, and activation scope.
- Assistant scope can target selected bots, symbol groups, or BotStrategy bindings.

## Frontend and Admin Surfaces (Post-MVP / V1.1 Planned)
- Scope note: `admin` and `billing` surfaces below are planning-only and are not part of current V1 implementation closure.
- `public`: informational pages, onboarding, auth entry.
- `client/dashboard`: full user product experience after login.
- `admin`: owner-only business control panel (pricing, plan limits, mode entitlements, critical settings).
- Entitlement UX rule: all key capabilities are visible for all plans; unavailable ones are shown as locked with clear upgrade context.
- Bot creation is also entitlement-gated: when mode pool limit is reached, new bot creation (including draft/non-active bot) is blocked.
- At bot cap, `Create bot` remains visible but disabled, with tooltip/helper copy and one-plan `Upgrade to ...` CTA.

## Launch Subscription Presets (Post-MVP / V1.1 Planned Defaults)
- `free`: 1 bot, PAPER only, max 1 strategy per bot, backtest range limited to last 30 days, max 1 concurrent backtest.
- `free`: seed limits `LIVE=0`, `PAPER=1`; both pools are independently configurable from admin panel.
- `free`: no LIVE access and no time-limited LIVE trial in V1.
- `simple`: seed limits `LIVE=1`, `PAPER=1`; both pools are independently configurable from admin panel (LIVE seed slot is not converted to extra PAPER in seed model), max 3 concurrent backtests.
- `advanced`: seed limits `LIVE=3`, `PAPER=3`; both pools are independently configurable from admin panel (all 3 seed LIVE can run concurrently, subject to consent and safety limits), max 10 concurrent backtests.
- Presets are editable from admin panel and are not hardcoded forever.

## History Export Policy (Post-MVP / V1.1 Planned)
- CSV export is available for active and `PAST_DUE` accounts.
- Plan-based max export range:
  - `free`: last 3 months.
  - `simple`: last 6 months.
  - `advanced`: last 12 months.
- Export throttling: max 1 CSV export per user per 10 minutes by default.
- Cooldown is configurable from admin controls based on average generation time and platform load.

## Plan Change Policy (Post-MVP / V1.1 Planned)
- Upgrade to a higher plan is immediate after charging only the difference between plans for the current billing period.
- After successful upgrade payment, entitlement changes become effective immediately in the active user session (no re-login required).
- If upgrade payment fails, the current plan and entitlements remain unchanged.
- Abuse protection: after 3 consecutive failed payment attempts, checkout is temporarily blocked (default cooldown: 15 minutes) before another attempt.
- Anti-abuse counters in V1 are keyed by `user + IP` context where possible.
- Equivalent protection should exist for login and repeated unauthorized/forbidden high-risk requests, with temporary cooldown and audit logging.
- Login protection in V1 uses escalating lockouts on both account and IP in parallel:
  - 3 failed attempts: 5-minute lock.
  - 5 failed attempts: 15-minute lock.
  - 10 failed attempts: 4-hour lock.
- Security email is sent at the first lock threshold and explains both current lock and stronger consequences for further failed attempts.
- Lockout thresholds and durations should be configurable in security settings.
- Locked users can complete a self-service recovery form with control questions derived from account data; successful verification unlocks access automatically.
- Admin retains manual security override for lock removal (account/IP) in incident scenarios.
- Admin can manually grant or adjust subscription tier and subscription validity window for selected user accounts (for example internal or promotional free access).
- Admin manual grants support two start modes: immediate (`now`) and scheduled future start date/time.
- When scheduled admin grant starts, it replaces the currently active user plan for the grant window.
- Manual admin grants default to `auto-renew OFF` to avoid unintended charging after grant period.
- When manual grant period ends, account returns to the plan state active before grant started.
- Return to previous paid plan after grant expiry keeps original billing renewal date (subscription cycle continuity).
- Subscription panel shows active plan as the single primary plan status; if grant is active, it is displayed as additional info.
- Grant visibility: always visible in subscription area; optionally shown as small dashboard-wide badge where space constraints allow without harming readability.
- In V1, users cannot end active admin grant early from self-service UI; grant stays active until its configured end.
- Admin can end active grant early when needed (for example security or policy reasons).
- Admin early-grant termination requires mandatory reason input and audit-log persistence.
- Reason description length in V1 must be between 10 and 500 characters.
- Reason category and reason description for admin security/grant actions are English-only in V1.
- Early grant termination triggers user email notification with reason category + reason text and effective termination time.
- Reason category is chosen from controlled predefined options in admin UI (no custom free-text category names).
- Category set is stable by default, with admin ability to add new categories when needed.
- Existing baseline categories should stay immutable in V1 for audit/report consistency.
- New admin-added categories are immediately available globally (no draft stage).
- Category removal in V1 is soft-delete only: removed categories are no longer selectable for new actions, while audit history keeps past references.
- Admin can reactivate soft-deleted categories.
- Reactivated category becomes available immediately across admin workflows.
- Downgrade to a lower plan is scheduled for period end to avoid disabling already-paid features early.
- Billing cycle in V1 is monthly-only.
- Annual billing options are planned no earlier than V2.
- Checkout in V1 follows one primary payment flow only (minimal path to reduce delivery risk).
- Checkout in V1 is account-based and requires authenticated user session (no guest checkout).
- Exactly one subscription can be active per user account at a time in V1.
- Payment rails expansion (fiat + crypto) is planned for V2.
- Gift-card purchase model is not planned for V1 and can be evaluated in V2.
- Invoice/receipt is generated automatically after each successful payment, downloadable in user account area, and confirmed by email.
- Payment document language policy: V1 English-only; V2 targets English original plus user-language version where gateway capabilities allow.
- Billing profile edits apply only to future invoice/receipt documents; already issued documents remain immutable.
- Billing profile is not required at account registration in V1.
- Billing profile is required at first payment attempt (just-in-time), while still allowing users to prefill it earlier from account settings.
- Missing billing profile should not trigger recurring reminder spam when user is not in checkout flow.
- If checkout is interrupted by missing billing profile, product should restore user to the same checkout flow immediately after profile completion.
- Billing profile forms in V1 enforce only general required-field and format validation (for example email format, country presence, postal-code shape, field lengths).
- Country-specific tax-ID/VAT validation is not part of V1 scope.
- Billing identity data is user-declared; platform checks completeness/format but does not guarantee factual identity correctness.
- Auto-renew is enabled by default (user can turn it off in account settings).
- User receives renewal and failed-payment reminders.
- If subscription is unpaid after expiry, paid runtime features are not served: no automated bot decisions or LIVE management actions are executed.
- On unpaid expiry, bot runtime switch is set to `OFF`.
- After payment return, user must manually switch bots back `ON` (no automatic restart).
- On successful payment return, system sends one reminder notification to re-enable bots manually when applicable.
- Subscription-loss status is communicated in one central account notification flow (avoid duplicated alerts across many widgets/pages).
- Expiry notification timing: emit one central notification at T+1 minute after subscription expiry.
- In `PAST_DUE`, user still has dashboard access for history and settings; blocked scope is limited to paid runtime execution features.
- Disabled LIVE controls include short contextual helper copy with resume hint, instead of repeating full subscription warning blocks.
- Locked feature CTA uses a consistent pattern with exactly one explicit entitlement target: the nearest higher plan that unlocks the feature (for example: `Upgrade to: Simple`, or `Upgrade to: Advanced` when needed).

## MVP Strategy Schema (Frozen)
- Strategy payload uses sections: `entry`, `exit`, `risk`, `filters`, `timeframes`.
- Schema version is fixed as `1.0` for MVP.
- `entry` and `exit` use top-level `logic` (`AND`/`OR`) with flat `rules` arrays.
- `risk` includes: position sizing, leverage, TP/SL, trailing, DCA, max open positions.
- `filters` includes: symbol mode, whitelist/blacklist, stable-pair exclusion, min 24h volume.
- `timeframes` is an explicit list used by strategy rules.
- Deep nested rule trees are explicitly out of MVP and can be added after MVP.

## MVP Preset Storage (Resolved)
- Presets are code-defined templates managed in repository source.
- MVP keeps presets read-only (no preset create/edit/delete by users).
- API exposes predefined presets for builder selection.
- DB-backed preset storage is deferred until post-MVP sharing/versioning needs.

## Planned Scope (After MVP)
- Additional exchange support beyond Binance using adapter-based integrations.
- Strategy export/import as JSON with versioned format.
- Hedge mode (long and short on same symbol).
- Advanced risk limits (max daily loss, drawdown, consecutive losses).
- Cooldown after losses.
- Additional data sources (order book, funding, open interest).
- Advanced time-based conditions.
- Optional AI advisor layer.
- Native mobile app if PWA is insufficient.

## Non-Goals
- Financial advice or guaranteed profit.
- Black-box automation without user control.

## UX Goals (Design Direction)
- Clean, serious UI. Focus on readability and safety.
- Clear separation of backtest, paper, and live modes.
- Every risky action must be explicit and reversible.
- Dashboard is a safety-first control center that surfaces risk and required actions in under 10 seconds.
- UI must prioritize explainability: users can inspect why a signal, order, or position decision happened.

## UX and Design System Baseline (MVP)
- One shared app shell and visual language across all dashboard pages.
- Reusable component primitives for KPI cards, status cards, tables, feeds, alerts, and risk actions.
- Unified view-state behavior (`loading`, `empty`, `degraded`, `error`, `success`) on all data-driven pages.
- Consistent semantic color tokens for risk and execution mode (`paper`, `live`, `warning`, `danger`).
- Uniform interaction patterns for filtering, pagination, confirmations, and destructive actions.

## Localization Baseline
- English (`en`) is the source and default locale.
- Polish (`pl`) is supported in MVP as a complete secondary locale for core flows.
- UI text must use translation keys (no hardcoded page strings in components).
- All date, number, currency, and percent rendering must be locale-aware.
- Architecture must allow adding additional locales after MVP without redesigning page structure.
