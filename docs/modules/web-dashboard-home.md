# Web Deep-Dive: Dashboard Home Module

## Metadata
- Module name: `dashboard-home`
- Layer: `web`
- Source path: `apps/web/src/features/dashboard-home`
- Owner: frontend/runtime-observability
- Last updated: 2026-04-12
- Related planning task: `DCP-08`

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
  1. List bots and prioritize active scope (LIVE first, then PAPER).
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

