# Web Deep-Dive: Wallets Module

## Metadata
- Module name: `wallets`
- Layer: `web`
- Source path: `apps/web/src/features/wallets`
- Owner: frontend/trading-setup
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- Owns wallet management UI for trading context setup.
- Provides list/create/edit flows and balance preview integration.
- Serves as required prerequisite for bot creation (`walletId`-first contract).

Out of scope:
- Bot form orchestration and runtime operations.
- API-key storage lifecycle management.

## 2. Boundaries and Dependencies
- Route entrypoints:
  - `/dashboard/wallets/list`
  - `/dashboard/wallets/create`
  - `/dashboard/wallets/:id/edit`
  - `/dashboard/wallets` and `/dashboard/wallets/:id` redirect to canonical list/edit routes
- Depends on:
  - wallets API service (`features/wallets/services/wallets.service.ts`)
  - exchange capability metadata for dynamic form constraints
  - shared async retry utilities for critical requests

## 3. Data and Contract Surface
- API contracts used:
  - list/get/create/update/delete wallet
  - metadata lookup (`/dashboard/wallets/metadata`)
  - balance preview (`/dashboard/wallets/preview-balance`)
- Form contracts:
  - mode-aware PAPER/LIVE field requirements and allocation modes

## 4. Runtime Flows
- List flow:
  1. Load wallets with filters.
  2. Render table and delete actions.
  3. Surface empty state guidance for first wallet setup.
- Create/edit flow:
  1. Load metadata and (for edit) existing wallet.
  2. Enforce mode-aware form sections.
  3. Preview LIVE balance when API key and allocation are provided.
  4. Save wallet payload and return to list/edit context.

## 5. UI Integration
- Main components:
  - `WalletsListTable`
  - `WalletCreateEditForm`
  - route-level wrapper `WalletFormPageContent`

## 6. Security and Risk Guardrails
- LIVE preview requires linked API key context from authenticated backend.
- Form enforces mode-switch cleanup and prevents stale cross-mode payload leakage.
- Delete flow respects backend conflict contract when wallet is linked to active bots.

## 7. Observability and Operations
- Metadata source and preview states are surfaced in form UX to explain capability fallback.
- Retry-aware request helpers reduce transient load/save failures.

## 8. Test Coverage and Evidence
- Primary tests:
  - `WalletCreateEditForm.test.tsx`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/wallets/components/WalletCreateEditForm.test.tsx
```

## 9. Open Issues and Follow-Ups
- Add list-table regression coverage for delete and filter interactions.
- Expand supported exchange-specific preview behavior as connectors mature.

