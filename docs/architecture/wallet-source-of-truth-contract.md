# Wallet Source-of-Truth Contract

Status: accepted (2026-04-16)

## Purpose
- Make `Wallet` the canonical owner of bot execution mode and capital budgeting context.
- Remove duplicated mode/capital decisions from bot write contracts.
- Keep runtime budgeting and UI behavior deterministic under shared-wallet usage.

## Canonical Ownership
1. `Wallet` is the source-of-truth for bot execution context:
   - `mode` (`PAPER` or `LIVE`),
   - venue context (`exchange`, `marketType`, `baseCurrency`),
   - capital reference (`paperInitialBalance` or live allocation policy).
2. Bot write contract is wallet-first (`walletId` required after compatibility window).
3. Shared wallet is allowed: multiple bots can bind to one wallet.
4. Backtests remain wallet-independent and keep explicit `initialBalance`.

## Context Invariants
1. `wallet.exchange == marketUniverse.exchange`
2. `wallet.marketType == marketUniverse.marketType`
3. `wallet.baseCurrency == marketUniverse.baseCurrency`
4. `wallet.mode == LIVE` requires exchange capability `LIVE_EXECUTION`
5. Wallet-context mismatch in bot create/update or runtime execution is fail-closed.

## Capital Policy
- Hard-fail policy is mandatory: when required margin exceeds wallet free budget, reject order (`OPEN`/`DCA`) and do not auto-clamp size.

### PAPER wallet
`referenceBalance = paperInitialBalance + realizedPnl(walletId)`

`freeCash = referenceBalance - reservedMargin(walletId)`

### LIVE wallet
`accountBalance = exchangeBalance(wallet.baseCurrency)`

`walletCap = percent(accountBalance) OR fixedAllocation`

`referenceBalance = min(accountBalance, walletCap)`

`freeCash = referenceBalance - reservedMargin(walletId)`

## Bot/API Contract
- Bot create/update no longer accepts mode as canonical input.
- During compatibility window, legacy bot fields (`mode`, `paperStartBalance`, `apiKeyId`) are derived from wallet only.
- Required wallet error contract:
  - `WALLET_NOT_FOUND`
  - `WALLET_MODE_INVALID`
  - `WALLET_LIVE_API_KEY_REQUIRED`
  - `WALLET_LIVE_API_KEY_EXCHANGE_MISMATCH`
  - `WALLET_MARKET_CONTEXT_MISMATCH`
  - `WALLET_INSUFFICIENT_FUNDS`
  - `WALLET_IN_USE_CANNOT_DELETE`

## Dashboard IA Contract
- Wallet module is a first-class dashboard area.
- Canonical navigation placement for V1 wallet-first rollout: `Exchanges -> Wallets -> Markets`.
- Bot creator/edit flows must present wallet selector as the execution-context input.

## Non-goals
- No forced wallet dependency for backtests.
- No strategy-logic changes.
- No new exchange adapter rollout in this contract.
