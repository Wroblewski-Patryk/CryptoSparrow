# API Deep-Dive: Exchange Module

## Metadata
- Module name: `exchange`
- Layer: `api`
- Source path: `apps/api/src/modules/exchange`
- Owner: backend/trading-integration
- Last updated: 2026-04-12
- Related planning task: `DCP-05`

## 1. Purpose and Scope
- Encapsulates exchange integration primitives, currently centered on Binance/CCXT futures paths.
- Provides:
  - connector lifecycle and exchange-side order operations
  - live order retry and fee reconciliation adapter
  - exchange capability matrix and guard helpers
  - symbol trading-rule resolution for pre-trade validation

Out of scope:
- Public route ownership.
- Trading decision logic (engine module).

## 2. Boundaries and Dependencies
- No direct router mount; consumed by orders, engine, profile API-key probe, wallets/markets capability checks.
- Depends on:
  - CCXT integration.
  - metrics store for exchange runtime metrics.
  - reconciliation helper services (`liveFeeReconciliation`).

## 3. Data and Contract Surface
- Core contracts:
  - `CcxtFuturesConnectorConfig`, `CcxtFuturesOrderRequest`, `CcxtFuturesOrderResult`.
  - `PlaceLiveOrderInput` and adapter result with fee metadata.
- Capability contracts:
  - `EXCHANGE_CAPABILITIES` matrix and `assertExchangeCapability`.
  - market-type/base-currency fallback mappings.
- Key outputs for callers:
  - order id/status/fill payload.
  - fee source (`ESTIMATED`/`EXCHANGE_FILL`) and pending flags.
  - symbol trading rules (`minAmount`, `minNotional`, precision).

## 4. Runtime Flows
- LIVE order flow:
  1. Parse/validate adapter input.
  2. Place order through CCXT connector.
  3. Retry on retryable transport/error patterns.
  4. Reconcile final fees/fills via exchange data.
  5. Emit exchange metrics and structured logs.
- Capability check flow:
  - caller asserts exchange supports required feature before operation.

## 5. API and UI Integration
- No direct endpoints.
- Indirect API consumers:
  - `/dashboard/orders/open` LIVE path.
  - profile API-key connection tests.
  - wallets/markets capability-driven UX constraints.

## 6. Security and Risk Guardrails
- Exchange capability assertions fail closed for unsupported providers/features.
- LIVE retries bounded by max attempts/backoff policy.
- Connector validates position-side constraints in hedge/one-way modes.

## 7. Observability and Operations
- Structured logging for live-order success/retry/failure events.
- Metrics: attempt/retry/failure counters + reconciliation delay signals.
- Environment toggles support strict/optional convergence behavior in caller modules.

## 8. Test Coverage and Evidence
- Representative tests:
  - `ccxtFuturesConnector.service.test.ts`
  - `liveOrderAdapter.service.test.ts`
  - `exchangeSymbolRules.service.test.ts`
  - `liveFeeReconciliation.service.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/exchange/ccxtFuturesConnector.service.test.ts src/modules/exchange/liveOrderAdapter.service.test.ts src/modules/exchange/exchangeSymbolRules.service.test.ts src/modules/exchange/liveFeeReconciliation.service.test.ts
```

## 9. Open Issues and Follow-Ups
- Expand first-class implementation coverage beyond Binance capability matrix placeholders.
- Continue contract unification with shared exchange constants between API and Web.
