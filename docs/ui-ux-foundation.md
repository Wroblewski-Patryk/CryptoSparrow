# UI/UX Foundation (MVP Baseline)

## Purpose
This document defines the baseline UX and UI assumptions for CryptoSparrow dashboard pages. It is the shared foundation for implementation and future task breakdown.

## Product UX North Star
- The post-login experience is an operator control center, not a generic landing page.
- Users should understand safety and required actions in under 10 seconds.
- Risk and operational status always have higher information priority than secondary analytics.
- Explainability is mandatory for trading decisions and critical system actions.

## Global Information Architecture (MVP)
1. `/dashboard` (Control Center)
2. `/dashboard/strategies`
3. `/dashboard/markets`
4. `/dashboard/bots`
5. `/dashboard/orders`
6. `/dashboard/positions`
7. `/dashboard/backtest`
8. `/dashboard/reports`
9. `/dashboard/logs`
10. `/dashboard/exchanges`
11. `/dashboard/profile`

## Control Center Requirements (`/dashboard`)

### Primary objective
Provide a fast, actionable overview of risk, exposure, and bot execution health.

### Required sections (top to bottom)
1. Safety bar (sticky under header):
   - execution mode (`paper`, `live`, or mixed)
   - exchange connectivity status
   - bot heartbeat freshness
   - emergency stop action
2. KPI row:
   - open positions
   - unrealized PnL
   - margin usage
   - open orders
   - risk alerts
   - bots running
3. Main operational grid:
   - positions snapshot (primary panel)
   - bot status and quick actions (secondary panel)
4. Secondary grid:
   - orders snapshot with failure context
   - recent activity/audit feed
5. Risk notice footer:
   - user responsibility reminder and logs shortcut

### Interaction constraints
- Risky actions (live start/stop, emergency controls) require explicit confirmation.
- Every critical card must support drill-down navigation to its dedicated page.
- Seed/demo states must be clearly labeled until connected to live data.

## Cross-Module UX Baseline
- All pages use a consistent app shell and page-header pattern.
- All data views use a consistent state model:
  - `loading`
  - `empty`
  - `degraded` (partial data available)
  - `error`
  - `success`
- All table/list screens follow one common interaction model:
  - filter bar
  - sorting
  - pagination
  - row-level actions
  - clear empty and error handling
- All destructive actions use a shared confirmation pattern.

## Design System Baseline

### Tokenized foundation
- Color tokens: base, text, border, success, warning, danger, info, paper mode, live mode.
- Spacing tokens: one unified spacing scale.
- Radius/shadow tokens: reusable card and panel depth styles.
- Typography tokens: UI text styles and metric/number styles.
- Motion tokens: short utility transitions for state and feedback.

### Core reusable components
- Layout: `AppHeader`, `DashboardNav`, `PageHeader`, `Breadcrumbs`.
- Status: `ModeBadge`, `ConnectionBadge`, `SeverityBadge`, `HeartbeatBadge`.
- Data: `KpiCard`, `StatusCard`, `SnapshotTable`, `AuditFeed`, `MetricTile`.
- Actions: `ActionBar`, `QuickActionGroup`, `ConfirmModal`, `DangerActionModal`.
- States: `SkeletonState`, `EmptyState`, `ErrorState`, `RetryState`, `DegradedState`.

## Localization and Content Standards
- Default locale is English (`en`).
- Polish (`pl`) is required as a secondary locale for MVP core flows.
- Additional locales are planned after MVP and must be supported by architecture.
- No hardcoded UI copy in page components.
- Translation keys must be namespaced by feature (example: `dashboard.kpi.openPositions`).
- Date/time and numeric formats must use locale-aware formatters.
- Severity labels and risk labels must use consistent, translatable vocabulary.

## Accessibility and Readability Baseline
- Keyboard operability for all controls and table actions.
- Visible focus state on interactive elements.
- Semantic headings and landmarks for screen-reader navigation.
- Minimum contrast suitable for high-information financial dashboards.
- Dense data must remain legible on desktop, tablet, and mobile.

## Risk and Trust UX Rules
- Paper/live mode must be visible in global chrome and on local action panels.
- Any action that can open/close/alter live exposure must show explicit risk context.
- User-facing decisions should link to logs where possible.
- "Not financial advice" and user responsibility messaging should be present in relevant control-center contexts.

## Module-Specific UX Expectations (MVP)
- Strategies: clear strategy identity, risk profile summary, and safe version edits.
- Markets: transparent universe filtering with visible include/exclude outcomes.
- Bots: operational state machine visibility (running, paused, stopped, degraded).
- Orders: rejection and failure reason clarity for operational recovery.
- Positions: PnL and risk parameter visibility in one place.
- Backtest: setup-to-results flow with transparent assumptions.
- Reports: concise performance narratives with drawdown and cost visibility.
- Logs: high signal-to-noise with severity and source filtering.
- Exchanges: secure credentials UX with masked outputs and health checks.

## Non-Goals for MVP UI
- Overly decorative or entertainment-style visual language.
- Hidden automation behavior without visible controls.
- Fragmented page-specific UI patterns that break consistency.
- Locale behavior that duplicates layouts per language.
