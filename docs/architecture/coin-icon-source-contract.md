# Coin Icon Source Contract (CoinGecko + Fallback)

Status: Canonical (ICN-01)  
Last updated: 2026-04-05  
Scope: Dashboard/UI asset icons for symbols shown in runtime, lists, cards, and tables.

## Goal

Define one deterministic icon-source contract so UI can render coin/token icons reliably without coupling to exchange-specific icon catalogs.

## Source of Truth

- Primary source: CoinGecko metadata (id + image URL).
- Exchange icon catalogs are not canonical for UI rendering.
- Resolution must stay exchange-independent for shared symbol views.

## Fallback Chain (Required)

When icon lookup is requested, resolver must follow this exact order:

1. CoinGecko resolved icon URL.
2. Local curated symbol map (`BTC`, `ETH`, etc.).
3. Deterministic generic placeholder icon.

## API Output Contract (Target for ICN-02/03)

Lookup output must be deterministic and safe for direct UI rendering:

- `symbol: string` - original symbol key requested by caller.
- `baseAsset: string` - normalized asset key used by resolver (uppercase).
- `iconUrl: string` - final URL/asset used by UI.
- `source: "coingecko" | "curated" | "placeholder"` - selected source tier.
- `placeholder: boolean` - quick UI flag (`true` only for generic fallback).
- `coinGeckoId: string | null` - resolved CoinGecko id when available.
- `cacheHit: boolean` - indicates whether result came from cache.
- `resolvedAt: string` - ISO timestamp of returned metadata snapshot.

## Failure Semantics

- Resolver errors must never break API response shape.
- Upstream failure (CoinGecko unavailable/rate-limited/timeout) must degrade to curated map or placeholder.
- UI must always receive renderable metadata (no broken-image hard failure contract).

## Cache Contract

- Icon metadata lookup is cache-backed with TTL.
- Cache key must be based on normalized asset key, not exchange pair string.
- TTL must be env-configurable for stage/prod tuning.
- Stale cache may be served during temporary upstream failures (fail-soft behavior).

## Deployment Controls

Required env-configurable controls:

- `COINGECKO_API_BASE_URL`
- `COINGECKO_API_KEY` (optional in local/dev, recommended for stage/prod)
- `COIN_ICON_CACHE_TTL_MINUTES`

## Non-Goals

- No dependency on admin-managed icon CMS in this phase.
- No migration to a full local static icon pack in this phase.
- No UI redesign dependency; contract is backend/data-first.

## Linked Planning

- `docs/planning/mvp-execution-plan.md` -> Phase 32 (`ICN-01..ICN-07`)
- `docs/planning/coin-icons-coingecko-plan-2026-04-05.md`
- `docs/planning/open-decisions.md` -> Coin Icon Source Policy
