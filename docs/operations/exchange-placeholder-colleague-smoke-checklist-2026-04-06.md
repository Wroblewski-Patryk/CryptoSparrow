# Exchange Placeholder Colleague Smoke Checklist (2026-04-06)

## Scope
- Placeholder exchanges: `BYBIT`, `OKX`, `KRAKEN`, `COINBASE`.
- Goal: confirm create/save/read flows stay open, while execution paths remain fail-closed.

## Environment
- Workspace: `C:\Personal\Projekty\Aplikacje\CryptoSparrow`
- App modules: `Markets`, `Profile -> API Keys`, `Bots`.
- Suggested account: dedicated QA user with no production API keys.

## Manual Checklist (Colleague Run)

### 1. Markets: create/save/read placeholder universe
- [ ] Open `Dashboard -> Markets`.
- [ ] In exchange selector, confirm options include `BYBIT`, `OKX`, `KRAKEN`, `COINBASE`.
- [ ] Pick each placeholder exchange and confirm warning copy is visible:
  `Placeholder exchange selected. Public catalog for this exchange is not implemented yet. You can still save the universe context.`
- [ ] Save a universe context for each placeholder exchange.
- [ ] Confirm created rows are visible in list with correct exchange value (read contract).

### 2. API keys: create/save/read placeholder credentials
- [ ] Open `Dashboard -> Exchanges`.
- [ ] In API key form, confirm exchange selector includes all placeholder exchanges.
- [ ] Pick each placeholder exchange and confirm info copy is visible:
  `API key test is not available for this exchange yet (placeholder adapter). Saving is still allowed.`
- [ ] Save key record for each placeholder exchange without connection probe.
- [ ] Confirm saved rows are visible in API key list with persisted exchange value (read contract).

### 3. Bots: blocked execute contract for placeholders
- [ ] Create bot for placeholder market universe with `PAPER` mode and inactive state.
- [ ] Confirm create succeeds (configuration path is allowed).
- [ ] Try to activate placeholder bot in `PAPER` mode and confirm action is blocked.
- [ ] Confirm UI shows placeholder activation hint and API returns fail-closed response (no silent fallback to Binance).
- [ ] Repeat activation check in `LIVE` mode and confirm blocked execution contract remains explicit.

## Expected Fail-Closed API Contract
- HTTP status: `501`
- Error details:
  - `code: EXCHANGE_NOT_IMPLEMENTED`
  - `exchange: <selected placeholder>`
  - `capability: MARKET_CATALOG | API_KEY_PROBE | PAPER_PRICING_FEED` (by endpoint)

## Automated Regression Evidence (This Commit Window)
- `pnpm --filter web exec vitest run src/features/profile/components/ApiKeyForm.test.tsx src/features/markets/components/MarketsFlow.test.tsx src/features/bots/components/BotCreateEditForm.test.tsx`
  - Result: PASS (`14 passed`).
- `pnpm --filter api test -- src/modules/markets/markets.e2e.test.ts src/modules/profile/apiKey/apiKey.e2e.test.ts src/modules/bots/bots.e2e.test.ts --testTimeout=30000`
  - Result: PASS (`48 passed`).

## Notes
- This checklist is intentionally focused on colleague validation readiness for placeholder exchanges.
- Binance execution behavior remains outside this checklist and is covered by separate runtime/live smoke packs.
