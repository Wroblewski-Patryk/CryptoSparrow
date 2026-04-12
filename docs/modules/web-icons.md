# Web Deep-Dive: Icons Module

## Metadata
- Module name: `icons`
- Layer: `web`
- Source path: `apps/web/src/features/icons`
- Owner: frontend/shared-ui
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- Provides reusable symbol-to-icon lookup hook for trading UI surfaces.
- Integrates with API icon resolver to enrich symbols in tables/cards.

Out of scope:
- Icon rendering components (consumers handle presentation).
- Persistent icon catalog management.

## 2. Boundaries and Dependencies
- Core files:
  - `hooks/useCoinIconLookup.ts`
  - `services/icons.service.ts`
  - `types/icon.type.ts`
- Depends on:
  - `/dashboard/icons/lookup` API endpoint
  - symbol normalization utilities from `lib/symbols`

## 3. Data and Contract Surface
- Input contract:
  - list of symbols from consuming module
- Service output:
  - `Map<symbol, CoinIconLookupItem>`
- Hook output:
  - `iconMap`, `loading`, `error`

## 4. Runtime Flows
- Lookup flow:
  1. Normalize and deduplicate symbols.
  2. Request icon metadata from API.
  3. Convert response to symbol-indexed map.
  4. Expose loading/error state for graceful UI fallback.

## 5. UI Integration
- Consumed by:
  - dashboard-home runtime symbol displays
  - bots runtime/list symbol displays
  - any module needing symbol icon hydration

## 6. Security and Risk Guardrails
- Icon fetches are authenticated dashboard API calls.
- Hook fails safe with empty map on request failures.

## 7. Observability and Operations
- Error state is exposed to consumers so they can downgrade to symbol-only rendering.
- Symbol normalization avoids duplicated requests for equivalent symbols.

## 8. Test Coverage and Evidence
- No dedicated module-local tests currently.
- Behavior is indirectly exercised by dashboard-home and bots component test suites.

## 9. Open Issues and Follow-Ups
- Add unit tests for hook deduplication and cancellation behavior.
- Consider shared cache layer for cross-component icon lookup reuse.

