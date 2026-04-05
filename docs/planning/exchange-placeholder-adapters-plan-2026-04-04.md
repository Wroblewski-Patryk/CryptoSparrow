# Exchange Placeholder Adapters Plan (EXPH) - 2026-04-04

Status: partially completed; remaining tasks tracked in canonical plan (reconciled 2026-04-05).

## Objective

Prepare the platform for multi-exchange testing by introducing **non-trading placeholders** for:

- `BYBIT`
- `OKX`
- `KRAKEN`
- `COINBASE`

while keeping current production behavior unchanged (`BINANCE` only, `SPOT/FUTURES`).

## Repo Audit (Current State)

Confirmed in code and DB schema:

- `Exchange` enum currently includes only `BINANCE`
  - `apps/api/prisma/schema.prisma`
- Web forms/types are hard-limited to `BINANCE`
  - markets creator/list
  - profile API key form
  - bots types/flows
- Runtime/live execution and market catalog are Binance-bound:
  - `markets.service.ts` uses Binance public endpoints + `ccxt` Binance constructors
  - live execution paths use `CcxtFuturesConnector` with Binance-oriented assumptions in service wiring

Current market dimensions already present and reusable:

- `TradeMarket = SPOT | FUTURES`
- context bindings on `MarketUniverse`, `Bot`, and creators.

## Capability Snapshot (Adapter Readiness)

This matrix is only used to scope placeholders and later adapter milestones.

- `BINANCE`: Spot + Futures already used by app.
- `BYBIT`: V5 API documents unified Spot/Derivatives/Options model (`category`-based routing).
- `OKX`: V5 API ecosystem is used by official/unofficial SDKs for spot and derivatives families (SWAP/FUTURES/OPTION).
- `KRAKEN`: API center exposes separate Spot and Futures tracks.
- `COINBASE`: Advanced Trade API exposes REST/WebSocket trading/data stack (spot-focused integration baseline for our placeholders).

Important: in this wave, these are **selection placeholders only**. No new live trading path is enabled.

## Product Contract for Placeholder Wave

1. User can select new exchanges in UI where exchange is currently selected.
2. Data/runtime safety stays fail-closed:
   - if exchange is not `BINANCE`, any unsupported operation returns explicit `NOT_IMPLEMENTED_FOR_EXCHANGE`.
3. No silent fallback to Binance when user selected another exchange.
4. Existing Binance behavior remains fully backward compatible.

## API/DB Contract (Placeholder Wave)

1. Extend `Exchange` enum:
   - `BINANCE`, `BYBIT`, `OKX`, `KRAKEN`, `COINBASE`.
2. Keep existing defaults:
   - default exchange remains `BINANCE`.
3. Add centralized exchange capability registry (code-level map), for example:
   - supports spot catalog?
   - supports futures catalog?
   - supports live execution?
   - supports paper pricing feed?
4. Non-Binance operations in unsupported modules must throw stable domain error code:
   - `EXCHANGE_NOT_IMPLEMENTED`.

## UX Contract (Placeholder Wave)

1. Creators and settings should list new exchanges.
2. Unsupported exchange paths should show deterministic helper copy:
   - "Exchange placeholder available, adapter not implemented yet."
3. For colleague testing:
   - allow configuration and context persistence,
   - block execution actions with clear message instead of silent failure.

## Tiny-Commit Sequence (Proposed)

Phase A - contract and schema
- [x] `EXPH-01 docs(contract): publish exchange placeholder contract and fail-closed behavior`
- [x] `EXPH-02 feat(db): extend Exchange enum with BYBIT/OKX/KRAKEN/COINBASE (BINANCE default preserved)`

Phase B - shared capability map
- [x] `EXPH-03 feat(api-core): add centralized exchange capability registry (catalog/runtime/live flags)`
- [x] `EXPH-04 feat(api-errors): add EXCHANGE_NOT_IMPLEMENTED domain error mapping + controller responses`

Phase C - API safety gates
- [x] `EXPH-05 feat(api-markets): route market-catalog by exchange and return not-implemented for non-Binance placeholders`
- [x] `EXPH-06 feat(api-bots): enforce fail-closed runtime/live guards for placeholder exchanges`
- [x] `EXPH-07 feat(api-profile): allow saving API keys for placeholder exchanges without enabling live execution paths`

Phase D - web wiring
- [x] `EXPH-08 feat(web-types): extend Exchange unions/options across Markets/Bots/Profile modules`
- [x] `EXPH-09 feat(web-ux): render placeholder badges/hints for unsupported exchange operations`
- [ ] `EXPH-10 test(web): add regression coverage for exchange select options and not-implemented UX states`

Phase E - verification
- [ ] `EXPH-11 test(api): add contract tests for placeholder exchange fail-closed responses`
- [ ] `EXPH-12 chore(qa): manual smoke checklist for colleague exchange testing (create/save/read + blocked execute)`

## Done Criteria

- Exchange selectors include `BYBIT/OKX/KRAKEN/COINBASE`.
- New exchange values persist in DB/API payloads.
- Unsupported actions fail with explicit, stable error contract.
- Binance behavior remains unchanged.
- Tests cover both success (persistence) and fail-closed (execution/catalog) paths.

## References

- Bybit V5 intro (unified Spot/Derivatives/Options): [bybit-exchange.github.io/docs/v5/intro](https://bybit-exchange.github.io/docs/v5/intro)
- Kraken API center (Spot/Futures tracks): [docs.kraken.com/api/docs/guides/spot-rest-intro](https://docs.kraken.com/api/docs/guides/spot-rest-intro/)
- Coinbase Advanced Trade overview (REST/WebSocket): [docs.cdp.coinbase.com/coinbase-business/advanced-trade-apis/overview](https://docs.cdp.coinbase.com/coinbase-business/advanced-trade-apis/overview)
