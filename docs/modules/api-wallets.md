# API Deep-Dive: Wallets Module

## Metadata
- Module name: `wallets`
- Layer: `api`
- Source path: `apps/api/src/modules/wallets`
- Owner: backend/trading-domain
- Last updated: 2026-04-12
- Related planning task: `DCP-07`

## 1. Purpose and Scope
- Owns wallet lifecycle and balance preview APIs for dashboard trading setup.
- Provides canonical wallet context (mode, exchange, market type, base currency, allocation, apiKey) used by bots.
- Wallet creation is the required prerequisite step before creating a bot.

Out of scope:
- API key storage lifecycle (profile api-keys module).
- Runtime order execution flow (orders/engine/exchange modules).

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/wallets`.
- Depends on:
  - Prisma wallet and bot relations.
  - exchange capability guards (`LIVE_EXECUTION`, `PAPER_PRICING_FEED`, market type/base currency support).
  - market catalog integration for metadata enrichment.
  - encrypted API key decryption and Binance balance fetch for preview.

## 3. Data and Contract Surface
- Command contracts:
  - `CreateWalletSchema`, `UpdateWalletSchema`
  - mode-dependent validation for LIVE allocation + apiKey binding
- Query contracts:
  - `ListWalletsQuerySchema`
  - `WalletMetadataQuerySchema`
  - `WalletBalancePreviewSchema`
- Key invariants:
  - LIVE wallet requires compatible API key from same exchange.
  - mode/exchange must be supported by capability map.
  - wallet cannot be deleted when linked bot exists.

## 4. Runtime Flows
- Create/update wallet flow:
  1. Normalize and validate payload.
  2. Enforce exchange capability for selected mode.
  3. Enforce LIVE api-key ownership and exchange compatibility.
  4. Persist wallet with normalized base currency and allocation fields.
- Metadata flow:
  1. Resolve supported market types for exchange.
  2. Fetch market catalog when available.
  3. Return per-marketType base currency options with fallback source marker.
- Preview balance flow:
  1. Validate owned API key for user+exchange.
  2. Decrypt credentials and fetch exchange balance snapshot.
  3. Compute reference balance using allocation mode/value.
  4. Return preview payload with source and fetched timestamp.

## 5. API and UI Integration
- Representative routes:
  - `GET /dashboard/wallets`
  - `GET /dashboard/wallets/metadata`
  - `POST /dashboard/wallets/preview-balance`
  - `GET /dashboard/wallets/:id`
  - `POST /dashboard/wallets`
  - `PUT /dashboard/wallets/:id`
  - `DELETE /dashboard/wallets/:id`
- Rate limits:
  - read: 120/min
  - write: 40/min
  - preview-balance: 20/min (user+exchange scoped)

## 6. Security and Risk Guardrails
- Auth required for all wallet endpoints.
- Strong input validation for LIVE mode and allocation fields.
- LIVE preview requires owned encrypted API key and exchange match.
- Delete protection prevents orphan bot references and unsafe teardown.

## 7. Observability and Operations
- Preview path updates `apiKey.lastUsed` for operational traceability.
- Metadata responses declare source (`MARKET_CATALOG` vs `EXCHANGE_CAPABILITIES`) for fallback diagnostics.

## 8. Test Coverage and Evidence
- Primary tests:
  - `wallets.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/wallets/wallets.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Expand preview support beyond Binance as exchange adapters mature.
- Add explicit audit log entries for wallet create/update/delete events.

