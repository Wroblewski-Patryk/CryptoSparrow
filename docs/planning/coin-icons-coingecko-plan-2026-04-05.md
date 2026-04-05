# Coin Icons (CoinGecko) Rollout Plan - 2026-04-05

## Goal
Add stable coin/token icons across dashboard surfaces using CoinGecko as primary source, without coupling UI rendering to exchange-specific icon assets.

## Why Now
- current UI relies mostly on symbol text only, which slows visual scanning in lists/tables,
- exchange APIs are not a reliable canonical icon source for broad multi-asset coverage,
- CoinGecko provides broad catalog coverage and practical URL metadata for icons.

## Scope
- In scope:
  - symbol -> icon resolution contract,
  - API-side cache and fallback behavior,
  - web rendering in selected dashboard surfaces,
  - deployment/env controls for stage/prod.
- Out of scope:
  - full historical/local icon asset pack migration in this phase,
  - admin CMS for icon overrides (can be added later).

## Source and Fallback Contract
- Primary source: CoinGecko icon metadata.
- No hard dependency on exchange icon catalogs.
- Required fallback chain:
  1. CoinGecko resolved icon URL,
  2. local curated symbol map (`BTC`, `ETH`, etc.) to known safe URLs/assets,
  3. generic placeholder icon.
- Behavior rule:
  - icon lookup failures must never break table/card rendering,
  - unresolved symbols return deterministic placeholder metadata.

## Tiny Commit Queue
- `ICN-01 docs(contract)` freeze API/UI contract and fallback policy.
- `ICN-02 feat(api-icons)` add resolver + cache (`symbol -> {id,image,lastUpdated}`) with TTL.
- `ICN-03 feat(api-icons)` expose lookup endpoint for dashboard consumers.
- `ICN-04 feat(web-icons)` render icons in selected modules (Dashboard/Bots/Markets/Positions) with fallback states.
- `ICN-05 ops(deploy)` add env template and rollout notes for Coolify stage/prod.
- `ICN-06 test(api+web)` add regressions for collision, fallback, and UI render states.
- `ICN-07 qa(web)` run manual smoke and attach evidence note.

## Deployment Notes
- Add env controls:
  - `COINGECKO_API_BASE_URL`,
  - `COINGECKO_API_KEY` (optional, recommended for stage/prod),
  - `COIN_ICON_CACHE_TTL_MINUTES`.
- Rollout order:
  1. stage deploy with cache enabled,
  2. verify icon endpoint latency/error rates,
  3. verify dashboard fallback behavior under forced upstream failure,
  4. promote to prod.

## Acceptance Criteria
- key dashboard surfaces render icons for major assets without UI regressions,
- unresolved symbols always show placeholder (no broken image artifacts),
- API lookup remains deterministic with cache fallback during temporary CoinGecko issues,
- deployment docs contain required env keys and verification steps.
