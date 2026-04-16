# Wallet Lifecycle and Insufficient-Funds Runbook

Status: active operational runbook for wallet-first bot setup and runtime budget incidents.

## 1. Scope
This runbook covers:
- wallet lifecycle in dashboard (`create`, `update`, `bind`, `delete`),
- PAPER/LIVE wallet operating rules,
- troubleshooting wallet-budget blocks (`WALLET_INSUFFICIENT_FUNDS`),
- safe corrective actions before resuming bot activity.

Out of scope:
- exchange API-key onboarding details (use `docs/operations/binance-api-key-onboarding-runbook.md`),
- generic deploy/recovery procedures (use `docs/operations/v1-ops-runbook.md`).

## 2. Canonical Contract (Operator View)
- Wallet is the source-of-truth for bot execution context:
  - mode (`PAPER` or `LIVE`),
  - venue context (`exchange`, `marketType`, `baseCurrency`),
  - capital reference (`paperInitialBalance` or LIVE allocation policy).
- Bot create/update is wallet-first (`walletId` required).
- Shared wallet is allowed (multiple bots can bind to one wallet).
- Hard-fail budget policy is mandatory:
  - if required margin exceeds wallet free budget, runtime blocks OPEN/DCA,
  - no auto-clamp of order size is applied.

## 3. Pre-Start Checklist
1. API and web are reachable:
```powershell
curl http://localhost:3001/health
curl http://localhost:3002
```
2. Wallet endpoints are available for authenticated user:
  - `GET /dashboard/wallets`
  - `GET /dashboard/wallets/metadata`
3. For LIVE wallet actions:
  - valid API key exists in `Dashboard -> Profile`,
  - API key exchange matches planned wallet exchange.

## 4. Safe Wallet Lifecycle
### A) Create PAPER wallet
1. Open `Dashboard -> Wallets -> Create`.
2. Set `mode=PAPER`.
3. Verify:
  - exchange and market type are correct for planned bot universe,
  - `paperInitialBalance` is realistic for strategy leverage and risk profile.
4. Save and confirm wallet appears on `/dashboard/wallets/list`.

### B) Create LIVE wallet
1. Set `mode=LIVE`.
2. Select matching API key.
3. Set allocation policy:
  - `PERCENT` (must be `>0` and `<=100`),
  - `FIXED` (must be `>0`).
4. Run balance preview (`POST /dashboard/wallets/preview-balance`) and verify:
  - `accountBalance`,
  - `freeBalance`,
  - `referenceBalance` after allocation.
5. Save only when preview and context are correct.

### C) Update wallet safely
1. Before changing exchange/market/base context, list linked bots.
2. Ensure linked bots are deactivated if context change is planned.
3. For LIVE updates, re-validate API key + allocation contract.
4. Save and verify bot create/edit still accepts this wallet context.

### D) Bind wallet to bot
1. In bot form, select wallet first.
2. Confirm market-group context compatibility:
  - wallet exchange/market/base must match selected market-group universe.
3. If LIVE bot:
  - enable `liveOptIn`,
  - provide `consentTextVersion`.

### E) Delete wallet safely
1. Check whether any bot still references wallet.
2. If linked, delete is blocked with conflict contract:
  - `WALLET_IN_USE_CANNOT_DELETE` (HTTP `409`).
3. Detach or remove linked bots first, then retry delete.

## 5. Error Contract Quick Map
- `WALLET_MODE_INVALID` (`400`): invalid LIVE allocation mode/value.
- `WALLET_LIVE_API_KEY_REQUIRED` (`400`): LIVE wallet missing/invalid `apiKeyId`.
- `WALLET_LIVE_API_KEY_EXCHANGE_MISMATCH` (`400`): API key exchange differs from wallet exchange.
- `WALLET_IN_USE_CANNOT_DELETE` (`409`): wallet still linked to at least one bot.
- `WALLET_MARKET_CONTEXT_MISMATCH` (`400` on bot write): wallet context differs from selected market group.
- `WALLET_INSUFFICIENT_FUNDS` (runtime pre-trade block): OPEN/DCA rejected by wallet free-budget guard.

## 6. Troubleshooting: WALLET_INSUFFICIENT_FUNDS
### Symptoms
- Bot is active and runtime session is running, but no new OPEN/DCA orders are created.
- Session metrics progress without expected position growth.
- No new runtime-managed open position for symbol despite qualifying signal windows.

### Fast triage
1. Confirm active runtime session:
```http
GET /dashboard/bots/:id/runtime-sessions?status=RUNNING&limit=5
```
2. Check symbol-level runtime stats:
```http
GET /dashboard/bots/:id/runtime-sessions/:sessionId/symbol-stats?symbol=BTCUSDT&limit=50
```
3. Check whether any runtime-managed position was opened:
```http
GET /dashboard/bots/:id/runtime-sessions/:sessionId/positions?symbol=BTCUSDT&limit=50
```
4. Check trade output:
```http
GET /dashboard/bots/:id/runtime-sessions/:sessionId/trades?symbol=BTCUSDT&limit=50
```
5. Validate wallet financial context:
  - `GET /dashboard/wallets/:walletId`
  - `POST /dashboard/wallets/preview-balance` with current LIVE allocation input.

### Deep diagnostics
If fast triage is inconclusive, inspect runtime event stream in data layer:
1. Open Prisma Studio:
```powershell
pnpm --filter api exec prisma studio
```
2. Inspect `BotRuntimeEvent` rows for affected `sessionId`.
3. Look for `eventType=PRETRADE_BLOCKED` and payload reason `WALLET_INSUFFICIENT_FUNDS`.

### Common root causes
- LIVE allocation too restrictive versus current required margin.
- PAPER `paperInitialBalance` too low for strategy leverage/quantity.
- Shared wallet is consumed by other active bots (reserved margin already high).
- Base-currency/exchange context mismatch caused wrong budget assumptions upstream.

### Safe corrective actions
1. Deactivate affected bot to avoid repeated blocked attempts.
2. Apply one change at a time:
  - increase PAPER start balance, or
  - adjust LIVE allocation mode/value, or
  - reduce leverage/risk and re-run, or
  - move bot to dedicated wallet if shared-wallet pressure is high.
3. Re-run balance preview and verify reference/free budget.
4. Reactivate bot and monitor next session window before broad rollout.

## 7. Validation Commands
Use these commands after wallet contract changes or incident fix:
```powershell
pnpm --filter api test -- src/modules/wallets/wallets.crud.e2e.test.ts
pnpm --filter api test -- src/modules/bots/bots.wallet-contract.e2e.test.ts
pnpm --filter api test -- src/modules/engine/runtimeCapitalContext.service.test.ts src/modules/engine/runtimeSignalLoop.service.test.ts
pnpm --filter web test -- src/features/wallets/components/WalletCreateEditForm.test.tsx src/features/bots/components/BotCreateEditForm.test.tsx
```

## 8. Escalation and Evidence
For every wallet-budget incident, capture:
- user id, bot id, wallet id, session id (if available),
- mode (`PAPER`/`LIVE`) and symbol(s),
- timestamp range in UTC,
- API responses (status + error code),
- runtime metrics snapshot before/after mitigation,
- exact mitigation applied and outcome.

Store evidence in `docs/operations` with timestamped artifact naming aligned to release checklist conventions.
