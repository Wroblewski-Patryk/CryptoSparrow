# API Deep-Dive: Positions Module

## Metadata
- Module name: `positions`
- Layer: `api`
- Source path: `apps/api/src/modules/positions`
- Owner: backend/trading-domain
- Last updated: 2026-04-12
- Related planning task: `DCP-06`

## 1. Purpose and Scope
- Owns position read and external reconciliation surfaces for dashboard operations.
- Provides:
  - list/get position APIs
  - live reconciliation status
  - exchange snapshot fetch
  - takeover status classification and rebind entrypoint
  - management mode switch endpoint

Out of scope:
- Order command lifecycle (orders module).
- Strategy signal execution decisions (engine).

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/positions`.
- Depends on:
  - `prisma` position/order/apiKey persistence.
  - CCXT Binance snapshots for external positions/open orders.
  - live reconciliation service and takeover classification helpers.

## 3. Data and Contract Surface
- Contracts include:
  - `ExternalTakeoverStatusResponse`
  - `ExchangePositionSnapshot` / `ExchangeOpenOrderSnapshot`
  - management mode update payloads.
- Status model:
  - `OWNED_AND_MANAGED`, `UNOWNED`, `AMBIGUOUS`, `MANUAL_ONLY`.
- Error contract:
  - `ExchangeSnapshotError` with explicit code categories.

## 4. Runtime Flows
- Snapshot flow:
  1. Resolve usable API key.
  2. Fetch external positions/open orders.
  3. Normalize payload shape.
  4. Update `lastUsed` metadata for key.
- Takeover status flow:
  - classify open exchange-synced positions by ownership/management/sync-state.
- Rebind flow:
  - attempts deterministic rebind of candidate external positions to owned bot context.

## 5. API and UI Integration
- Routes:
  - `GET /dashboard/positions`
  - `GET /dashboard/positions/:id`
  - `GET /dashboard/positions/live-status`
  - `GET /dashboard/positions/exchange-snapshot`
  - `GET /dashboard/positions/takeover-status`
  - `POST /dashboard/positions/takeover-rebind`
  - `PATCH /dashboard/positions/:id/management-mode`

## 6. Security and Risk Guardrails
- Dashboard auth boundary + user ownership checks.
- Exchange snapshot fetch uses decrypted key in-process only.
- Management/takeover flows preserve explicit managed/manual state boundaries.

## 7. Observability and Operations
- Reconciliation/takeover correctness covered by dedicated e2e + service tests.
- Snapshot route has deterministic test-mode fallback responses.

## 8. Test Coverage and Evidence
- Primary tests:
  - `livePositionReconciliation.service.test.ts`
  - `positions-live-status.e2e.test.ts`
  - `positions.exchangeSnapshot.e2e.test.ts`
  - `positions.takeover-status.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/positions/livePositionReconciliation.service.test.ts src/modules/positions/positions-live-status.e2e.test.ts src/modules/positions/positions.exchangeSnapshot.e2e.test.ts src/modules/positions/positions.takeover-status.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Continue hardening takeover ambiguity handling as additional exchanges are enabled.
- Align error taxonomy with typed API-level mapping strategy.
