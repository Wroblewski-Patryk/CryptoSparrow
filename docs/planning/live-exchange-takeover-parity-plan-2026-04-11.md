# Live Exchange Takeover Parity Plan (2026-04-11)

Status: execution-complete (follow-up production rollout verification required)

## Execution Progress (2026-04-11)
- Completed:
  - `LBT-02` ownership persistence for `EXCHANGE_SYNC` (`botId`/`walletId`) with deterministic resolver.
  - `LBT-03` fail-closed runtime skip for unowned bot-managed external rows (`EXCHANGE_SYNC` + missing `botId`).
  - `LBT-05` live pretrade exposure check (`hasOpenPosition`) with short TTL cache.
  - `LBT-06` live pretrade symbol-rules validation (`minAmount`/`minNotional`/precision) with TTL cache.
  - `LBT-08` optional LIVE futures margin/leverage convergence (`setMarginMode`/`setLeverage`) with env kill-switch and TTL convergence cache.
  - `LBT-09` open-order reconciliation for `EXCHANGE_SYNC` + `BOT_MANAGED` ownership (`upsert open exchange orders` + `close stale local synced opens`).
  - `LBT-10` takeover visibility API: `GET /dashboard/positions/takeover-status` + e2e contract.
  - `LBT-10` runtime/dashboard takeover badges for `EXCHANGE_SYNC` open positions.
  - `LBT-11` dashboard wallet/runtime fallback hardening for imported LIVE sources (no placeholder drift when compatibility fields are present).
  - `LBT-12` runtime/dashboard regression coverage for imported visibility + takeover badges + wallet compatibility fields.
  - `LBT-13` empty-group catalog fallback now opt-in only (`MARKET_STREAM_ALLOW_EMPTY_GROUP_CATALOG_FALLBACK=true`).
  - `LBT-14` strict local+VPS takeover smoke runbook (`docs/operations/live-takeover-local-vps-strict-smoke-checklist-2026-04-11.md`).
  - `LBT-15` local+VPS confidence artifact and report (`docs/operations/_artifacts-live-takeover-confidence-2026-04-11T14-48-55-096Z.json`, `docs/operations/live-takeover-confidence-pack-2026-04-11.md`).
- In progress:
  - none.
- Remaining:
  - none.
- Follow-up blockers observed during evidence run:
  - public-route OPS probes return `403` by policy (`/workers/*`, `/alerts`) and require private-route verification on VPS.
  - production target currently returns `404` for `/dashboard/positions/takeover-status`, indicating required API revision still needs rollout/verification on target.

## Goal
- Make LIVE bot behavior parity-complete with the legacy bot for exchange-connected trading:
  - adopt already-open exchange positions,
  - show them correctly in bot runtime + dashboard,
  - manage them on exchange safely (DCA/close) without phantom local-only actions,
  - avoid useless order attempts when exchange constraints already block execution.

## Legacy Baseline (source comparison)
- Legacy references:
  - `https://github.com/Wroblewski-Patryk/CryptoBot/blob/main/server/modules/positions/positions.service.js`
  - `https://github.com/Wroblewski-Patryk/CryptoBot/blob/main/server/modules/orders/orders.service.js`
  - `https://github.com/Wroblewski-Patryk/CryptoBot/blob/main/server/api/binance.service.js`
- Legacy capabilities verified:
  - exchange position refresh cache + open-position checks before new entry,
  - lifecycle loop over open positions (DCA/TP/TTP/SL/TSL),
  - order layer with per-symbol margin/leverage setup before submit,
  - open-orders cache,
  - exchange connectivity + time-sync bootstrap.

## Current Critical Gaps (repo audit)

### G1 - Imported exchange positions are not bound to a concrete LIVE bot/wallet
- Current reconciliation writes `botId: null`, `strategyId: null` for `EXCHANGE_SYNC` positions:
  - `apps/api/src/modules/positions/livePositionReconciliation.service.ts:136`
  - `apps/api/src/modules/positions/livePositionReconciliation.service.ts:145`
- LIVE order path requires `botId` (`LIVE_BOT_REQUIRED`):
  - `apps/api/src/modules/orders/orders.service.ts:82`
- Effect: imported positions can appear, but full live management path is inconsistent and can fail for DCA/close execution.

### G2 - Takeover ownership is implicit/read-time only, not persisted as execution ownership
- Runtime positions include `botId: null` external rows via symbol ownership mapping:
  - `apps/api/src/modules/bots/botsRuntimeRead.service.ts:843`
  - `apps/api/src/modules/bots/botsRuntimeRead.service.ts:851`
- Effect: visibility is best-effort, but execution + telemetry ownership remains unstable.

### G3 - Duplicate-open guard depends on reconciled local state only
- Signal loop blocks on local managed-external positions table read:
  - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts:565`
  - `apps/api/src/modules/engine/runtimeSignalLoop.repository.ts:60`
- Effect: if exchange position exists but reconcile has not ingested it yet, bot may still attempt open orders.

### G4 - API key manage toggle does not define explicit takeover mapping
- UI shows “bots ready to take over” list, but payload persists only booleans:
  - display-only section: `apps/web/src/features/profile/components/ApiKeyForm.tsx:511`
  - save payload: `apps/web/src/features/profile/components/ApiKeyForm.tsx:336`
- Effect: no explicit contract for which bot(s) should own imported positions for a key.

### G5 - Exchange execution preflight parity is weaker than legacy
- Legacy sets margin type/leverage before order submit.
- Current connector places order but has no explicit margin/leverage convergence path:
  - `apps/api/src/modules/exchange/ccxtFuturesConnector.service.ts`
- Effect: behavior can drift across symbols/accounts and lead to unexpected rejects.

### G6 - Empty symbol-group fallback can overload stream subscriptions on VPS
- Market-stream bootstrap can fallback to catalog symbols when groups are otherwise empty:
  - `apps/api/src/workers/marketStream.worker.ts:179`
- Effect: unconfigured LIVE bots can subscribe huge symbol sets, cause websocket churn, and delay runtime freshness.

## Delivery Plan (tiny-commit sequence)

### Phase A - Deterministic takeover ownership (must-have)

#### LBT-01
`docs(contract): define external-position takeover ownership contract`
- Add architecture contract:
  - ownership source of truth,
  - tie-break rules when multiple LIVE bots match same symbol/API key,
  - fail-closed behavior for ambiguous/unowned positions.

#### LBT-02
`feat(api-reconcile): persist botId+walletId ownership for BOT_MANAGED EXCHANGE_SYNC positions`
- Extend reconciliation to bind imported positions to one eligible LIVE bot + wallet (when deterministic).
- Keep `MANUAL_MANAGED` or mark unresolved state when ownership cannot be resolved safely.

#### LBT-03
`feat(api-runtime): enforce execution ownership for imported positions`
- Ensure automation uses persisted owner context (botId/walletId) for DCA/close in LIVE.
- Remove silent partial behavior for unbound BOT_MANAGED external positions (explicit block + telemetry).

#### LBT-04
`test(api): add e2e coverage for external-position takeover binding and live DCA/close path`
- Cases: single owner, ambiguous owner, no owner, manual-managed.

### Phase B - No useless exchange attempts (must-have)

#### LBT-05
`feat(api-pretrade): add direct exchange exposure preflight before live open`
- Before opening LIVE order, check current exchange position exposure for symbol (api key bound to wallet/bot).
- If exposure exists, block with deterministic reason and skip submit.
- Add short TTL cache to avoid high request volume.

#### LBT-06
`feat(api-orders): add exchange filters preflight cache (minNotional/stepSize/tickSize/leverage caps)`
- Resolve symbol constraints once (TTL cache), validate order viability before submit.
- Fail-fast when request cannot pass exchange filters.

#### LBT-07
`test(api): regression for duplicate-open race and filter-based fail-fast`
- Ensure zero order submit when preflight says impossible.

### Phase C - Exchange parity hardening (should-have)

#### LBT-08
`feat(api-live-exec): add optional per-symbol leverage/margin convergence before first live order`
- Safe idempotent set-if-drift for Binance futures.
- Configurable kill switch via env for controlled rollout.

#### LBT-09
`feat(api-sync): add open-order reconciliation for BOT_MANAGED external lifecycle`
- Improve local state coherence when exchange returns partial/open order states.

### Phase D - Runtime/UI correctness and operator UX (must-have for acceptance)

#### LBT-10
`feat(api+web): explicit takeover status endpoint and runtime badges`
- Show whether external position is:
  - `OWNED_AND_MANAGED`,
  - `UNOWNED`,
  - `AMBIGUOUS`,
  - `MANUAL_ONLY`.

#### LBT-11
`fix(web-dashboard): ensure imported live positions and wallet metrics render from owned runtime source`
- Remove `-` placeholders when data is available via owned runtime + wallet context.

#### LBT-12
`test(web): dashboard/runtime regression for imported position visibility and takeover state`

### Phase E - VPS resilience and rollout safety (must-have for production confidence)

#### LBT-13
`fix(worker-bootstrap): prevent empty symbol groups from forcing wide catalog subscriptions by default`
- Treat empty/unconfigured groups as inert unless explicitly enabled for catalog fallback.

#### LBT-14
`ops(runbook): local+VPS live verification checklist for takeover`
- Add strict smoke:
  - exchange-open position appears in runtime and dashboard,
  - no duplicate-open attempts,
  - DCA/close executed on exchange and persisted locally,
  - runtime freshness stays PASS under normal load.

#### LBT-15
`qa(evidence): execute local + VPS confidence pack and attach artifacts`

## Local/VPS Readiness Checklist (what must be true)
- API + `workers-execution` + `workers-market-stream` running simultaneously.
- Shared `DATABASE_URL` and `REDIS_URL` across API and workers.
- At least one active LIVE bot with wallet bound to the same API key used for takeover.
- Market groups for LIVE bots must be configured (empty groups treated as inert after `LBT-13`).
- API key has exchange permissions required for futures position/order management.

## Acceptance Criteria
- Existing exchange position is adopted into one deterministic LIVE bot ownership context.
- Position is visible in bot runtime and dashboard without manual refresh hacks.
- Runtime DCA/close for adopted position produces real exchange side effects and matching local records.
- Bot does not spam order submissions when exchange constraints/exposure already block entry.
- VPS runtime freshness remains stable after enabling takeover.

## Out of Scope (this plan)
- New exchange integrations beyond Binance.
- Strategy alpha/performance tuning.
- Subscription/business entitlement redesign.
