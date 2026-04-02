# LIVE Fee Reconciliation Contract

Status: canonical for `LIVE` mode (2026-04-02)

## Scope
- Applies to runtime execution when `bot.mode === LIVE`.
- Does **not** change fee policy for `PAPER` and `BACKTEST` (deterministic simulator fee model remains).

## Source of Truth
- Commission value used in persistence/reporting for LIVE must come from exchange execution data (fills/trades), not from static fee-rate estimation.

## Fallback Hierarchy (strict order)
1. Fills embedded directly in `createOrder` response.
2. `fetchOrder(id, symbol)` including trade/fill breakdown.
3. `fetchMyTrades(symbol, since, limit)` filtered by `orderId`.
4. Temporary estimated fee only as transient fallback while reconciliation is pending.

## Persistence Contract
- Runtime stores:
  - final fee total,
  - fee currency,
  - fee source marker (`EXCHANGE_FILL` or `ESTIMATED`),
  - pending reconciliation flag when exchange data is delayed.
- Raw exchange fill payload should be retained for audit/replay/reconciliation diagnostics.

## Runtime Behavior
- Order execution must not be blocked by temporary fee-data lag.
- If fee data is delayed:
  - mark `feePending=true`,
  - keep estimated fee as provisional value,
  - run bounded async reconciliation retries.
- Once exchange fill data is available:
  - overwrite provisional fee with exact fee,
  - set `feeSource=EXCHANGE_FILL`,
  - clear `feePending`.

## API/UI Contract
- History/runtime payloads expose:
  - `fee`,
  - `feeCurrency`,
  - `feeSource`,
  - `feePending`.
- UI never renders blank fee:
  - exact value when reconciled,
  - provisional value + pending/source marker otherwise.

## Determinism and Safety
- Reconciliation must be idempotent per order/trade (safe retries, no duplicate fee accumulation).
- Fee updates must be monotonic in quality:
  - `ESTIMATED` -> `EXCHANGE_FILL` allowed,
  - reverse downgrade not allowed.

