# Web Deep-Dive: Bots Module

## Metadata
- Module name: `bots`
- Layer: `web`
- Source path: `apps/web/src/features/bots`
- Owner: frontend/trading-runtime
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- Owns bot UI lifecycle and runtime operator surfaces:
  - list and delete bots
  - create/edit bot form
  - runtime monitoring workspace
  - assistant configuration and dry-run timeline
- Enforces wallet-first bot creation contract in UI (`walletId` required).

Out of scope:
- Runtime engine execution internals (API engine/bots modules).
- Wallet CRUD and market/strategy authoring forms.

## 2. Boundaries and Dependencies
- Route entrypoints:
  - `/dashboard/bots`
  - `/dashboard/bots/create` (`/dashboard/bots/new` legacy redirect)
  - `/dashboard/bots/:id/edit`
  - `/dashboard/bots/:id/preview`
  - `/dashboard/bots/:id/assistant`
- Depends on:
  - bots API services (`features/bots/services/bots.service.ts`)
  - markets, strategies, wallets data sources for create/edit form
  - exchange capability map and icon lookup hooks

## 3. Data and Contract Surface
- Command contracts:
  - create/update bot payload with `walletId`, `strategyId`, `marketGroupId`, `isActive`, `liveOptIn`, consent version.
- Runtime read contracts:
  - runtime sessions, symbol stats, positions, trades, runtime graph.
- Assistant contracts:
  - read/update assistant main config
  - read/update/delete subagent slots
  - dry-run trace execution

## 4. Runtime Flows
- Create/edit flow:
  1. Load strategies, market groups, and wallets.
  2. Require non-empty `walletId` and context match with selected market group.
  3. Enforce capability checks for activation and LIVE prerequisites (linked API key + consent).
  4. Submit create/update and navigate to bots list/preview path.
- Monitoring flow:
  1. Select bot/session and load runtime data sections.
  2. Apply filters for symbol/status/view mode.
  3. Support operator actions (close position) with explicit confirmations.
- Assistant flow:
  1. Load current assistant config for selected bot.
  2. Save main config and subagent slots.
  3. Run dry-run and present deterministic decision timeline.

## 5. UI Integration
- Main components:
  - `BotsListTable`
  - `BotCreateEditForm`
  - `BotsManagement` with tabs (`bots`, `monitoring`, `assistant`)
- Legacy helper routes:
  - `/dashboard/bots/runtime` and `/dashboard/bots/assistant` resolve to canonical bot-specific routes.

## 6. Security and Risk Guardrails
- LIVE mode actions require explicit risk confirmation.
- Activation is blocked when exchange capability or wallet context invariants fail.
- Runtime actions use protected API endpoints and user-scoped data.

## 7. Observability and Operations
- Monitoring views include heartbeat/session status badges and stale-data warnings.
- Assistant tab exposes per-slot status, latency, and message traces for operator diagnostics.

## 8. Test Coverage and Evidence
- Primary tests:
  - `BotCreateEditForm.test.tsx`
  - `BotsListTable.test.tsx`
  - `BotsManagement.test.tsx`
  - `trailingStopDisplay.test.ts`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/bots/components/BotCreateEditForm.test.tsx src/features/bots/components/BotsListTable.test.tsx src/features/bots/components/BotsManagement.test.tsx src/features/bots/utils/trailingStopDisplay.test.ts
```

## 9. Open Issues and Follow-Ups
- Continue decomposition of large monitoring container into smaller domain units.
- Replace remaining confirm-dialog browser primitives with app-level modal pattern.

