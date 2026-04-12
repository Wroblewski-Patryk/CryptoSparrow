# API Deep-Dive: Markets Module

## Metadata
- Module name: `markets`
- Layer: `api`
- Source path: `apps/api/src/modules/markets`
- Owner: backend/trading-domain
- Last updated: 2026-04-12
- Related planning task: `DCP-06`

## 1. Purpose and Scope
- Owns market universe CRUD and exchange market catalog read APIs.
- Resolves effective symbol sets from whitelist/blacklist model.
- Ensures market universes cannot be mutated while tied to active bot execution paths.

Out of scope:
- Bot runtime orchestration and signal evaluation.
- Wallet account lifecycle.

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/markets`.
- Depends on:
  - `prisma` for `marketUniverse` and related symbol-group updates.
  - exchange capability guard (`MARKET_CATALOG`).
  - symbol normalization helpers (`resolveUniverseSymbols`).
  - Binance public catalog and ticker enrichment path (with test fallback data).

## 3. Data and Contract Surface
- Universe contracts:
  - `CreateMarketUniverseDto`
  - `UpdateMarketUniverseDto`
- Catalog contract includes:
  - `exchange`, `marketType`, `baseCurrency`, `baseCurrencies`, `markets[]`.
- Guardrails:
  - active-bot usage block for updates/deletes (`MARKET_UNIVERSE_USED_BY_ACTIVE_BOT`).

## 4. Runtime Flows
- Catalog flow:
  1. Assert exchange capability.
  2. Resolve cached or fresh catalog entries.
  3. Select effective base currency.
  4. Return filtered/sorted market list.
- Universe update flow:
  1. Validate ownership.
  2. Ensure not used by active bot.
  3. Persist universe.
  4. Sync dependent symbol-group symbols if list filters changed.

## 5. API and UI Integration
- Routes:
  - `GET /dashboard/markets/universes`
  - `GET /dashboard/markets/universes/:id`
  - `GET /dashboard/markets/catalog`
  - `POST /dashboard/markets/universes`
  - `PUT /dashboard/markets/universes/:id`
  - `DELETE /dashboard/markets/universes/:id`

## 6. Security and Risk Guardrails
- Dashboard auth + ownership isolation for all universe operations.
- Capability assertion fails closed for unsupported exchanges.
- Active-runtime guardrail prevents mutation drift against running bots.

## 7. Observability and Operations
- Catalog fetch has in-memory cache and fallback behavior.
- Public-market fetch failures degrade to cached/test fixtures instead of hard outage.

## 8. Test Coverage and Evidence
- Primary test:
  - `apps/api/src/modules/markets/markets.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/markets/markets.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Continue consolidating symbol/base-currency normalization via shared primitives.
- Evaluate stronger metadata telemetry for catalog source freshness.
