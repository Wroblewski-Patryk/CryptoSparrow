# Exchange Context Consistency Plan (EXCTX) - 2026-04-01

Status: completed in canonical plan (reconciled with canonical completion log on 2026-04-17); retained as historical design reference.
Note: active execution history and closure evidence live in `docs/planning/mvp-execution-plan.md` (`EXCTX-01..EXCTX-17` marked done).

Related follow-up (2026-04-04):
- Exchange placeholder rollout for `BYBIT/OKX/KRAKEN/COINBASE` is tracked in `docs/planning/exchange-placeholder-adapters-plan-2026-04-04.md`.

## Objective
Guarantee one coherent venue context across:
- bot creator (`PAPER` and `LIVE`),
- backtest creator,
- runtime signal processing,
- market-data reads,
- live execution writes.

Target outcome: no mismatch where prices are taken from one venue/market while execution happens on another.

## Scope
- In scope:
  - venue context contract (`exchange`, `marketType`, `baseCurrency`) and ownership hierarchy,
  - creator UX alignment for bots/backtests,
  - API and runtime validation gates,
  - migration/backfill for existing data,
  - regression tests and operator-visible diagnostics.
- Out of scope:
  - adding a second exchange adapter implementation right now,
  - changing strategy logic semantics,
  - changing risk model formulas.

## Current State Audit (Repo-Based)

### What already exists
- `marketType` and `baseCurrency` are already present on `MarketUniverse`.
- `Bot.marketType` exists and is validated against linked market group type.
- bot duplicate guard for `strategy + marketGroup` is in place.
- runtime and pre-trade checks already use `marketType` guardrails.
- API-key management already stores `exchange` (`BINANCE` only).

### Gaps causing inconsistency risk
1. `MarketUniverse` has no explicit `exchange` field (only `marketType/baseCurrency`).
2. Backtest candle/supplemental fetch paths are hardcoded to Binance endpoints.
3. Runtime warmup/capital/execution paths are effectively Binance-bound and not explicitly tied to creator-selected venue context.
4. Bot/Backtest creators do not expose a first-class, explicit venue context summary/selection flow.
5. No hard guarantee that selected market universe context is the same context used by live execution account selection.

## Canonical Venue Context Contract (Target)

Define `VenueContext`:
- `exchange`: `BINANCE` (now), extensible enum.
- `marketType`: `SPOT | FUTURES`.
- `baseCurrency`: `USDT | ...` (from market catalog for selected exchange+marketType).

Contract invariants:
1. `MarketUniverse` is canonical source of truth for `VenueContext`.
2. `SymbolGroup` inherits `VenueContext` from parent universe.
3. Backtest run stores a snapshot of `VenueContext` used at creation time.
4. Bot stores/derives `VenueContext` from selected market group and cannot drift from it.
5. Runtime signal path accepts only market events with matching `exchange + marketType`.
6. LIVE execution must use an API key that matches bot `exchange` and supports required market scope.

## Product/UX Contract (Creators)

### Backtest Creator
- Keep market-group first workflow, but make venue context explicit:
  - `Market group` selector,
  - read-only context chips/fields:
    - `Exchange`,
    - `Market type`,
    - `Base currency`.
- Optional filters above group selector:
  - `Exchange`,
  - `Market type`,
  - `Base currency`.
  These filters do not become independent source-of-truth; they only narrow selectable groups.

### Bot Creator
- Same context pattern as backtest:
  - `Market group` selector,
  - explicit context block (`Exchange`, `Market type`, `Base currency`) bound to selected group.
- `paperStartBalance` remains only for `PAPER`.
- For `LIVE`:
  - require choosing or auto-resolving an exchange key that matches context,
  - surface clear mismatch errors before bot creation/activation.

## Data Model and API Plan

### DB changes (minimal and backward-safe)
1. Add `exchange` to `MarketUniverse` (default `BINANCE`).
2. Add `exchange` snapshot to backtest seed metadata (and optional dedicated run column if needed for reporting/indexing).
3. Add optional `apiKeyId` binding on `Bot` for explicit LIVE execution account context (recommended to avoid ambiguous "latest key" behavior).
4. Keep `Bot.marketType` for fast runtime filtering, but validate against linked group universe context.

### API contract changes
1. Markets:
  - universe create/update accepts `exchange` (default `BINANCE`).
  - market catalog endpoint accepts `exchange + marketType + baseCurrency`.
2. Backtests create:
  - derive context from selected universe,
  - reject explicit payload mismatches,
  - persist context snapshot into seed/report metadata.
3. Bots create/update/activate:
  - derive context from selected market group,
  - validate optional `apiKeyId` ownership and exchange match,
  - reject activation if venue context cannot be satisfied.

## Runtime and Engine Plan

1. Introduce venue-aware market data provider contract:
   - `getCandles(exchange, marketType, ...)`,
   - `getSupplementals(exchange, marketType, ...)`.
2. Introduce venue-aware runtime stream event contract:
   - event must include `exchange` (not only marketType/symbol).
3. Runtime signal loop:
   - process event only when bot context matches `exchange + marketType`.
4. LIVE order execution:
   - use bot-bound API key context (`apiKeyId`) or deterministic resolver,
   - reject when account context does not match bot venue context.
5. Paper mode:
   - pricing source must follow bot context exactly, same as backtest context rules.

## Validation and Guardrails

Add hard validation errors:
- `MARKET_UNIVERSE_CONTEXT_INVALID`
- `BOT_MARKET_GROUP_EXCHANGE_MISMATCH`
- `BOT_LIVE_API_KEY_EXCHANGE_MISMATCH`
- `BOT_LIVE_API_KEY_SCOPE_MISMATCH`
- `BACKTEST_CONTEXT_MISMATCH`
- `STREAM_EVENT_CONTEXT_MISMATCH`

Operator diagnostics:
- expose `exchange/marketType/baseCurrency` in bot runtime graph and backtest run header metadata.

## Migration and Rollout Strategy

### Migration sequence
1. Schema migration with defaults (`exchange=BINANCE` for all existing universes).
2. Backfill script:
   - populate missing context snapshots in existing runs where possible.
3. API compatibility window:
   - accept missing `exchange` in old payloads and fill `BINANCE`.
4. Remove compatibility branch only after test + smoke pass.

### Rollout safety
- Feature flag for strict context enforcement in LIVE activation path.
- Start with warn logs in PAPER/BACKTEST, then move to hard-fail once all clients are updated.

## Test Plan

### API tests
- Universe CRUD with exchange context.
- Backtest create rejects mismatched context.
- Bot create/activate rejects context mismatch with market group or API key.

### Runtime tests
- Signal loop ignores event with non-matching exchange.
- Live execution fails closed on API-key context mismatch.
- Paper/backtest use same venue context input and produce parity-friendly traces.

### Web tests
- Creator forms display derived venue context always.
- Filters narrow groups without breaking source-of-truth behavior.
- Error messages are clear on mismatch.

### E2E tests
- `strategy -> backtest -> paper -> live` with explicit venue context and no drift.
- Spot and futures contexts validated separately under same exchange.

## Tiny-Commit Execution Sequence (Proposed)

Phase A - contracts/docs
- [x] `EXCTX-01 docs(contract): publish venue-context source-of-truth and invariants for creators/runtime`
- [x] `EXCTX-02 docs(decisions): lock MarketUniverse as canonical exchange+marketType+base context owner`

Phase B - schema + migration
- [x] `EXCTX-03 feat(db): add exchange field to MarketUniverse with BINANCE default`
- [x] `EXCTX-04 feat(db): add bot live apiKey binding field for explicit execution venue context`
- [x] `EXCTX-05 chore(data-migration): backfill existing universes/runs with exchange context snapshot`

Phase C - API contract
- [x] `EXCTX-06 feat(api-markets): extend market-universe and catalog contracts with exchange context`
- [x] `EXCTX-07 feat(api-backtests): derive and persist exchange context from selected market universe`
- [x] `EXCTX-08 feat(api-bots): enforce bot/group/apiKey venue-context compatibility on create/activate`

Phase D - runtime/engine
- [x] `EXCTX-09 refactor(engine): introduce venue-aware market data provider contract`
- [x] `EXCTX-10 refactor(runtime): add exchange to stream-event context and enforce exchange+marketType match`
- [x] `EXCTX-11 feat(execution): bind live execution account selection to bot venue context`

Phase E - web UX
- [x] `EXCTX-12 feat(web-backtest-creator): show explicit exchange/marketType/base context bound to market group`
- [x] `EXCTX-13 feat(web-bot-creator): show explicit venue context and live api-key compatibility hints`
- [x] `EXCTX-14 test(web): add creator regression coverage for venue-context rendering and validation copy`

Phase F - verification
- [x] `EXCTX-15 test(api+runtime): add context mismatch contract tests for backtest/bot/live paths`
- [x] `EXCTX-16 test(e2e): add end-to-end venue consistency scenario (backtest->paper->live)`
- [x] `EXCTX-17 chore(qa): manual smoke checklist and evidence capture for creator/runtime consistency`

## Done Criteria
- Creator-selected context and runtime/execution context are provably identical.
- No endpoint allows silent exchange/market mismatch.
- Backtest, paper, and live all carry explicit venue context in metadata.
- Live execution account is deterministic and context-safe.
- Tests cover mismatch failures and happy path.
