# API Deep-Dive: Orders Module

## Metadata
- Module name: `orders`
- Layer: `api`
- Source path: `apps/api/src/modules/orders`
- Owner: backend/trading-domain
- Last updated: 2026-04-12
- Related planning task: `DCP-06`

## 1. Purpose and Scope
- Owns order read + command API:
  - list/get orders
  - open/cancel/close commands
- Bridges command path between PAPER simulation and LIVE exchange side effects.
- Applies pre-trade symbol constraints and optional leverage/margin convergence for LIVE.

Out of scope:
- Signal generation and strategy evaluation.
- Position ownership reconciliation domain logic (positions module).

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/orders`.
- Depends on:
  - `prisma` order persistence.
  - exchange connector/adapter (`CcxtFuturesConnector`, `LiveOrderAdapter`).
  - encrypted API-key resolution and bot LIVE context validation.
  - env-driven pretrade cache/convergence controls.

## 3. Data and Contract Surface
- Input DTOs:
  - `OpenOrderDto`, `CancelOrderDto`, `CloseOrderDto`, list query DTO.
- Output:
  - persisted order records with LIVE metadata (exchange order ids/fills/fees where available).
- LIVE invariants:
  - requires `riskAck`, LIVE bot mode, active opt-in, compatible API key.
  - enforces symbol trading rules and quantity/notional checks.

## 4. Runtime Flows
- Open order:
  1. Validate payload and mode context.
  2. For LIVE, resolve bot + API key + connector rules.
  3. Optionally converge leverage/margin mode.
  4. Place order via live adapter with retries + fee reconciliation.
  5. Persist normalized order state.
- Cancel/close:
  - resolve ownership and apply lifecycle transition with optional LIVE side effect.

## 5. API and UI Integration
- Routes:
  - `GET /dashboard/orders`
  - `GET /dashboard/orders/:id`
  - `POST /dashboard/orders/open`
  - `POST /dashboard/orders/:id/cancel`
  - `POST /dashboard/orders/:id/close`

## 6. Security and Risk Guardrails
- Auth + ownership checks on every route.
- LIVE execution requires explicit risk acknowledgement.
- Strict mode toggles can fail closed when leverage/margin convergence fails.

## 7. Observability and Operations
- Exchange attempt/retry/failure metrics emitted through adapter path.
- Caches for symbol rules/exposure/convergence reduce repetitive exchange calls.
- Contract/e2e tests cover order-position interactions.

## 8. Test Coverage and Evidence
- Primary tests:
  - `orders.service.test.ts`
  - `orders-positions.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/orders/orders.service.test.ts src/modules/orders/orders-positions.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Continue typed-error migration to replace message-based branching.
- Review cache invalidation strategy under high-frequency LIVE execution load.
