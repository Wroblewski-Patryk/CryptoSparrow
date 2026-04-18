# Web Deep-Dive: Dashboard Home Module

## Metadata
- Module name: `dashboard-home`
- Layer: `web`
- Source path: `apps/web/src/features/dashboard-home`
- Owner: frontend/runtime-observability
- Last updated: 2026-04-17
- Related planning task: `UXR-01`

## 1. Purpose and Scope
- Implements dashboard control-center home view (`/dashboard`) for runtime monitoring.
- Provides:
  - runtime onboarding (no bots / no active bots)
  - active bot runtime snapshot (positions, trades, signals)
  - market stream driven mark-price enrichment
  - risk and session summary side panel

Out of scope:
- Bot create/edit workflows (web-bots module).
- Backtest and reports detailed pages.

## 2. Boundaries and Dependencies
- Entry route:
  - `apps/web/src/app/dashboard/page.tsx`
- Main UI:
  - `HomeLiveWidgets.tsx`
  - split runtime sections under `components/home-live-widgets/*`
- Depends on:
  - bot runtime APIs from `features/bots/services/bots.service.ts`
  - market stream SSE helper (`lib/marketStream.ts`)
  - icon lookup hook (`features/icons/hooks/useCoinIconLookup`)
  - i18n and locale formatting providers

## 3. Data and Contract Surface
- Runtime read APIs consumed:
  - `GET /dashboard/bots`
  - `GET /dashboard/bots/:id/runtime-graph`
  - `GET /dashboard/bots/:id/runtime-sessions`
  - `GET /dashboard/bots/:id/runtime-sessions/:sessionId/symbol-stats`
  - `GET /dashboard/bots/:id/runtime-sessions/:sessionId/positions`
  - `GET /dashboard/bots/:id/runtime-sessions/:sessionId/trades`
  - `POST /dashboard/bots/:id/runtime-sessions/:sessionId/positions/:positionId/close`
- Stream contract:
  - `GET /dashboard/market-stream/events` via `EventSource`

## 4. Runtime Flows
- Initial load flow:
  1. List bots and build active scope mode-agnostically (`PAPER` + `LIVE`) with deterministic ordering and dashboard cap.
  2. For selected bots load sessions, runtime graph, symbol stats, and positions.
  3. Build unified runtime snapshot and summary metrics.
- Live refresh flow:
  1. Poll runtime snapshots every 5 seconds (silent refresh).
  2. Subscribe to ticker stream for visible symbols.
  3. Merge stream prices into open-position pnl calculations.
- Onboarding flow:
  - No bots: ordered steps start from wallet setup (`/dashboard/wallets/list`) before market/strategy/backtest/bot steps.
  - No active bots: same chain + activation step (`/dashboard/bots`).

## 5. UI Integration
- Route:
  - `/dashboard`
- Key states:
  - loading skeleton
  - hard error with retry
  - no bots onboarding
  - no active bots onboarding
  - live runtime workspace

## 6. Security and Risk Guardrails
- Dashboard page checks session and redirects unauthenticated user to `/auth/login`.
- Close-position action is explicit and routed through protected API.
- Runtime stale data warning is surfaced when refresh age threshold is exceeded.

## 7. Observability and Operations
- Stores selected bot and table preferences in local storage for operator continuity.
- Surfaces session heartbeat freshness, runtime status badges, and stale-data warnings.

## 8. Test Coverage and Evidence
- Primary tests:
  - `HomeLiveWidgets.test.tsx`
  - `LiveMarketBar.test.tsx`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/dashboard-home/components/HomeLiveWidgets.test.tsx src/features/dashboard-home/components/LiveMarketBar.test.tsx
```

## 9. Open Issues and Follow-Ups
- Consider virtualized tables for larger runtime payloads.
- Evaluate extracting additional controller concerns from `HomeLiveWidgets` to reduce component size pressure.

## 10. Dashboard Tabs Ownership and Visibility Matrix (`UXR-01`)
| Tab | Visibility contract | Actionability contract |
| --- | --- | --- |
| `positions` | Always rendered for active bot context. Rows include bot-scoped `BOT_MANAGED` positions and deterministic `EXCHANGE_SYNC` takeover rows mapped to selected bot. | Close action only for rows accepted by backend ownership contract (`OPEN + BOT_MANAGED + wallet-compatible + owned`). Non-owned/non-eligible rows are fail-closed by API (`ignored/no_open_position`). |
| `orders` | Always rendered in both `LIVE` and `PAPER` mode. Empty list is valid state. | Read-only list in this wave. No tab hiding fallback when list is empty. |
| `history` | Always rendered as runtime history surface in active bot context. | Read-only by default (no ownership mutation actions). |

- Operator note:
  - unresolved external takeover states (`UNOWNED`, `AMBIGUOUS`, `MANUAL_ONLY`) are not actionable from dashboard close flow.
  - onboarding sequence remains wallet-first when runtime context is missing (`/dashboard/wallets/list` as first step).

## 11. Runtime Selector Parity (`DBSEL-A`)
- Selector contract:
  - dashboard runtime selector includes all active bots regardless of mode (`PAPER` and `LIVE` together).
  - active bot mode must not filter out another active mode from selector options.
  - deterministic ordering and cap (`MAX_DASHBOARD_BOTS`) stay unchanged.
- Degraded contract:
  - if selected active bot has no runtime session, it remains selectable and runtime panel shows degraded/no-session copy instead of dropping that bot from selector.

## 12. Table Action and Clone Contract Linkage (`UXR-E`)
- Shared table action semantics:
  - dashboard-home adjacent list modules (`wallets`, `markets`, `strategies`, `backtests`, `bots`) must reuse one action tone/icon matrix (`edit`, `delete`, `clone`, `preview`, `runtime`, `details`) from shared `TableUi` presets.
- Clone invariants (cross-module dependency for dashboard operators):
  - cloned entities are named deterministically as `<name> (clone)`, then numbered on collisions.
  - clone flow copies only editable create-contract fields; runtime/history/system identifiers are never cloned.
- Operator continuity note:
  - cloned wallets/markets/strategies are expected to appear immediately in list context so they can be attached to bot/runtime workflows without manual page reload.
