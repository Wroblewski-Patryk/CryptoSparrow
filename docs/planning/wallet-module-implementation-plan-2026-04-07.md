# Wallet Module Implementation Plan (WLT) - 2026-04-07

Status: active, Phase A docs contracts completed (2026-04-16).

## Objective
Add a first-class `Wallet` module (CRUD + dashboard navigation) and make wallet context the source of truth for bot execution mode and capital budgeting.

## Integration Assessment
- Complexity: medium-high (touches DB + bot contracts + runtime capital path + bot creator UI).
- Net effect: positive for maintainability and operator clarity.
- Why it helps:
  - removes duplicated mode/capital decisions from bot form,
  - centralizes capital controls (paper/live) in one entity,
  - enables intentional capital sharing across multiple bots.

## Locked Product Decisions (2026-04-07)
1. Shared wallet is allowed: many bots can use one wallet.
2. Wallet mode determines bot behavior (`PAPER` vs `LIVE`).
3. Bot create/edit form no longer asks for mode directly; user selects wallet.
4. Backtests remain wallet-independent and keep explicit `initialBalance` input.
5. Capital policy is hard-fail: when wallet free budget is insufficient, do not auto-clamp order size.
6. Wallet must be exchange-context compatible with bot market group context.

## Scope
In scope:
- wallet CRUD module (API + web + menu),
- wallet-to-bot assignment,
- runtime budget enforcement for shared wallets,
- live allocation modes (`PERCENT`, `FIXED`) in wallet base currency,
- migration path from bot-owned mode/capital fields.

Out of scope:
- changing strategy decision logic,
- forcing backtest to use wallet,
- adding new exchange adapters beyond existing capability matrix.

## Domain Model Target

### New Wallet entity
- `id`, `userId`, `name`
- `mode`: `PAPER | LIVE`
- `exchange`: existing `Exchange` enum
- `marketType`: existing `TradeMarket` enum
- `baseCurrency`: string (default `USDT`)
- `paperInitialBalance` (required when `mode=PAPER`)
- `liveAllocationMode`: `PERCENT | FIXED` (required when `mode=LIVE`)
- `liveAllocationValue` (required when `mode=LIVE`)
- `apiKeyId` (required when `mode=LIVE`, must match `wallet.exchange`)
- timestamps

### Bot relation
- Add `Bot.walletId` (required after migration window).
- During compatibility window, bot keeps denormalized fields (`mode`, `paperStartBalance`, `exchange`, `apiKeyId`) but they are derived from wallet only.

### Runtime record attribution
- Add nullable `walletId` snapshot to `Position`, `Order`, `Trade`.
- New runtime writes stamp walletId from bot wallet at execution time.

## Capital Semantics

### PAPER wallet
`referenceBalance = paperInitialBalance + realizedPnl(walletId)`

`freeCash = referenceBalance - reservedMargin(walletId)`

### LIVE wallet
`accountBalance = fetched exchange balance for wallet.baseCurrency`

`walletCap =`
- `accountBalance * (percent / 100)` for `PERCENT`
- `liveAllocationValue` for `FIXED`

`referenceBalance = min(accountBalance, walletCap)`

`freeCash = referenceBalance - reservedMargin(walletId)`

If `requiredMargin > freeCash`, reject with hard-fail error.

## Context Invariants
1. `wallet.exchange == marketUniverse.exchange`
2. `wallet.marketType == marketUniverse.marketType`
3. `wallet.baseCurrency == marketUniverse.baseCurrency`
4. `wallet.mode == LIVE` requires exchange capability `LIVE_EXECUTION`
5. Strategy remains venue-agnostic (no strategy exchange field required now)

## Error Contract
- `WALLET_NOT_FOUND`
- `WALLET_MODE_INVALID`
- `WALLET_LIVE_API_KEY_REQUIRED`
- `WALLET_LIVE_API_KEY_EXCHANGE_MISMATCH`
- `WALLET_MARKET_CONTEXT_MISMATCH`
- `WALLET_INSUFFICIENT_FUNDS`
- `WALLET_IN_USE_CANNOT_DELETE`

## Backtest Decision
Backtest stays independent from wallets in V1:
- keep `seedConfig.initialBalance` in backtest form and API,
- do not introduce mandatory backtest wallet,
- no "special non-deletable wallet" in this rollout.

Rationale: avoids coupling simulation workflow to runtime wallet state and keeps existing backtest UX stable.

## Rollout Strategy (Compatibility-First)
1. Introduce Wallet model and link bot to wallet.
2. Backfill one wallet per existing bot to preserve exact current behavior.
3. Switch bot create/edit contract to `walletId` input.
4. Keep bot legacy fields as derived compatibility fields until runtime/web migration is complete.
5. Move runtime capital checks to wallet semantics.
6. Remove legacy bot-mode inputs from web form.
7. After verification, deprecate direct bot mode/capital write path.

## Tiny-Commit Execution Sequence

### Phase A - Contracts and Docs
- [x] `WLT-01 docs(contract): publish wallet source-of-truth contract and invariants`
- [x] `WLT-02 docs(decisions): lock shared-wallet + hard-fail + backtest-no-wallet decisions`
- [x] `WLT-03 docs(ui): define Wallet module IA and nav placement (between Exchanges and Markets)`

### Phase B - DB and Migration Foundation
- [x] `WLT-04 feat(db): add Wallet model + live-allocation enum + Bot.walletId relation (nullable in transition)`
- [x] `WLT-05 feat(db): add walletId snapshot column to Position/Order/Trade with indexes`
- [x] `WLT-06 chore(data-migration): create one wallet per existing bot and backfill Bot.walletId`
- [x] `WLT-07 test(db): migration/backfill safety checks and rollback notes`

### Phase C - Wallet API Module
- [x] `WLT-08 feat(api-wallets): add wallet CRUD routes/controller/service with ownership isolation`
- [x] `WLT-09 feat(api-wallets): enforce mode-specific validation and API-key compatibility checks`
- [x] `WLT-10 test(api-wallets): add e2e coverage for CRUD, validation, and delete guards`

### Phase D - Bot Contract Migration
- [x] `WLT-11 refactor(api-bots): require walletId in create/update and derive bot execution fields from wallet`
- [x] `WLT-12 feat(api-bots): enforce wallet-marketGroup exchange/marketType/baseCurrency compatibility`
- [x] `WLT-13 refactor(api-bots): mark direct mode/paperStartBalance/apiKeyId payload inputs as deprecated`
- [x] `WLT-14 test(api-bots): add regression tests for wallet binding, mismatch errors, and shared-wallet assignment`

### Phase E - Runtime Budget Enforcement
- [x] `WLT-15 refactor(runtime-capital): resolve reference balance from wallet context (paper/live rules)`
- [x] `WLT-16 feat(runtime-budget): enforce hard-fail wallet free-cash checks for OPEN and DCA`
- [ ] `WLT-17 feat(runtime-attribution): persist walletId snapshot on runtime-created positions/orders/trades`
- [ ] `WLT-18 test(runtime): shared-wallet multi-bot concurrency and insufficient-funds regressions`

### Phase F - Web Wallet Module + Bot Form
- [ ] `WLT-19 feat(web-nav): add Wallet menu entry between Exchanges and Markets`
- [ ] `WLT-20 feat(web-wallets): add /dashboard/wallets list/create/edit screens with mode-aware form`
- [ ] `WLT-21 refactor(web-bot-form): replace mode/paper-balance controls with wallet selector + context summary`
- [ ] `WLT-22 test(web): add regression coverage for wallet pages, nav placement, and bot-form payload changes`

### Phase G - QA and Stabilization
- [ ] `WLT-23 qa(api+web+runtime): execute end-to-end flow strategy -> bot(wallet) -> paper/live runtime`
- [ ] `WLT-24 docs(runbook): publish operator guide for wallet lifecycle and insufficient-funds troubleshooting`
- [ ] `WLT-25 release(gate): run lint/typecheck/tests and capture rollout evidence`

## Done Criteria
- Wallet module is fully available in dashboard navigation and supports CRUD.
- Bot form uses wallet selection only for execution mode/capital context.
- Runtime enforces wallet budget in hard-fail mode for both OPEN and DCA.
- Multiple bots can safely share one wallet.
- Backtest remains unaffected and continues to use `initialBalance`.
- API/web/runtime tests cover wallet mismatch and insufficient-funds scenarios.

## Progress Log
- 2026-04-16: Completed `WLT-16` by introducing explicit wallet free-cash guard primitive (`resolveRuntimeWalletFundsExhausted`) and wiring OPEN pre-trade runtime path to this hard-fail check (`WALLET_INSUFFICIENT_FUNDS` block before orchestrator), while keeping DCA hard-fail flow on the same capital guard contract; validated with targeted runtime suites (`runtimeCapitalContext`, `runtimeSignalLoop`, `runtimePositionAutomation`) and `pnpm --filter api run typecheck` (PASS).
- 2026-04-16: Completed `WLT-15` by hardening `runtimeCapitalContext` to wallet-first balance sourcing (no bot/latest API-key fallback when `walletId` is present, wallet-scoped LIVE fail-closed reference balance, and wallet-scoped PAPER start-balance fallback to `0` when wallet context is missing), with unit coverage added for wallet PAPER/LIVE semantics; validated with `pnpm --filter api test -- src/modules/engine/runtimeCapitalContext.service.test.ts` and `pnpm --filter api run typecheck` (PASS).
- 2026-04-16: Completed `WLT-14` by adding targeted bot wallet-contract e2e suite `apps/api/src/modules/bots/bots.wallet-contract.e2e.test.ts` (deprecated direct-field payload behavior, wallet-switch mismatch guard, shared-wallet assignment) and validating with `pnpm --filter api test -- src/modules/bots/bots.wallet-contract.e2e.test.ts` (PASS, `4/4`).
- 2026-04-16: Completed `WLT-13` by locking wallet-first write semantics in bot create/update payload handling where direct execution fields (`mode`, `paperStartBalance`, `apiKeyId`) are treated as deprecated compatibility inputs and do not override wallet-derived runtime context.
- 2026-04-16: Completed `WLT-12` by adding update-time wallet compatibility guard in `apps/api/src/modules/bots/botsCommand.service.ts` to reject `walletId` switches when existing bot market-group universe context (`exchange/marketType/baseCurrency`) mismatches selected wallet context.
- 2026-04-16: Completed `WLT-11` by validating wallet-first bot write contract in API command layer (`createBot`/`updateBot`) where persisted execution fields (`mode`, `exchange`, `marketType`, `paperStartBalance`, `apiKeyId`) are derived from wallet context rather than direct payload values.
- 2026-04-16: Completed `WLT-10` by adding dedicated wallet CRUD e2e contract suite `apps/api/src/modules/wallets/wallets.crud.e2e.test.ts` (create/update/delete/list ownership isolation, LIVE validation, api-key exchange mismatch, and in-use delete guard) and validating together with preview/metadata suite via `pnpm --filter api test -- src/modules/wallets/wallets.crud.e2e.test.ts src/modules/wallets/wallets.e2e.test.ts` (PASS, `14/14`).
- 2026-04-16: Completed `WLT-09` by hardening wallet mode validation in service layer (`assertWalletLiveModeConfig`) so LIVE wallets always require valid allocation mode/value even on partial updates, and by exposing mapped `WALLET_MODE_INVALID` controller response for deterministic API contract handling.
- 2026-04-16: Completed `WLT-08` by validating and hardening wallet CRUD ownership isolation contract in `apps/api/src/modules/wallets/wallets.routes.ts`, `wallets.controller.ts`, and `wallets.service.ts`, including partial-update safety fix in `UpdateWalletSchema` (remove create-time defaults from update payload).
- 2026-04-16: Completed `WLT-07` by adding DB-foundation verifier `apps/api/scripts/verifyWalletDbFoundation.ts`, generating PASS evidence artifacts (`docs/operations/_artifacts-wallet-db-foundation-2026-04-16T12-10-31-835Z.json`, `docs/operations/wallet-db-foundation-verification-2026-04-16T12-10-31-835Z.md`) with explicit rollback notes, and validating wallet regression contract via `pnpm --filter api test -- src/modules/wallets/wallets.e2e.test.ts` (PASS).
- 2026-04-16: Completed `WLT-06` by validating migration backfill contract in `apps/api/prisma/migrations/20260407121500_add_wallet_module/migration.sql` (`wallet-<botId>` wallet creation + `Bot.walletId` population for existing rows).
- 2026-04-16: Completed `WLT-05` by validating `walletId` snapshot columns, indexes, and FK links on `Position/Order/Trade` in Prisma schema + migration SQL (`Position_walletId_idx`, `Order_walletId_idx`, `Trade_walletId_idx`).
- 2026-04-16: Completed `WLT-04` by validating canonical DB foundation in Prisma (`Wallet` model, `WalletAllocationMode` enum, and transitional `Bot.walletId` relation) with migration `20260407121500_add_wallet_module`.
- 2026-04-16: Completed `WLT-01` by publishing canonical wallet source-of-truth contract in `docs/architecture/wallet-source-of-truth-contract.md` (ownership, invariants, capital policy, wallet-first bot write contract).
- 2026-04-16: Completed `WLT-02` by locking wallet-first product/runtime decisions in `docs/planning/open-decisions.md` (shared-wallet allowed, hard-fail insufficient funds, backtest-no-wallet, compatibility invariants).
- 2026-04-16: Completed `WLT-03` by defining dashboard IA placement contract (`Exchanges -> Wallets -> Markets`) in `docs/architecture/dashboard-route-map.md` and syncing module IA map in `docs/modules/system-modules.md`.
