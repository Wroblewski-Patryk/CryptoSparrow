# API Deep-Dive: Icons Module

## Metadata
- Module name: `icons`
- Layer: `api`
- Source path: `apps/api/src/modules/icons`
- Owner: backend/shared-services
- Last updated: 2026-04-12
- Related planning task: `DCP-07`

## 1. Purpose and Scope
- Resolves token/market symbols to icon URLs for dashboard tables and cards.
- Uses deterministic multi-step fallback chain:
  - CoinGecko lookup
  - curated static icon map
  - inline SVG placeholder

Out of scope:
- Persistent icon storage or admin-managed icon library.
- Frontend icon rendering behavior/styling.

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/icons`.
- Depends on:
  - symbol normalization/base-asset extraction rules.
  - external CoinGecko API (configurable base URL and optional API key).
  - in-memory TTL cache and request pacing controls.

## 3. Data and Contract Surface
- Query contract: `symbols` list (`CoinIconLookupQuerySchema`).
- Response contract per item:
  - `symbol`, `baseAsset`, `iconUrl`
  - `source` (`coingecko | curated | placeholder`)
  - `placeholder`, `coinGeckoId`, `cacheHit`, `resolvedAt`

## 4. Runtime Flows
- Lookup flow:
  1. Normalize requested symbols and derive base asset.
  2. Read cache by base asset; return cache hit if valid.
  3. Try preferred CoinGecko id hint; then search by symbol.
  4. Fallback to curated icon map.
  5. Fallback to deterministic inline placeholder SVG.
  6. Cache result with TTL for repeated requests.

## 5. API and UI Integration
- Representative route:
  - `GET /dashboard/icons/lookup`
- Rate limit:
  - 120 requests per 60 seconds.

## 6. Security and Risk Guardrails
- Auth required; no public icon lookup route.
- External fetches are timeout-bounded and rate paced.
- Resolver fails safe to local placeholder when network/provider fails.

## 7. Observability and Operations
- Response includes `cacheHit` and `source`, enabling easy fallback diagnostics.
- Env controls:
  - cache TTL
  - fetch timeout
  - fetch gap pacing
  - CoinGecko API base URL/key

## 8. Test Coverage and Evidence
- Primary tests:
  - `icons.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/icons/icons.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Consider cross-process cache if icon traffic rises in multi-instance deployment.
- Add telemetry counters for external provider failures and fallback rates.

