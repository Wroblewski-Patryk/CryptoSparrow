# Live Takeover Confidence Pack (2026-04-11)

Source artifact:
- `docs/operations/_artifacts-live-takeover-confidence-2026-04-11T14-48-55-096Z.json`

Scope:
- `LBT-15` execution evidence (local + VPS checks).

## 1) Local Confidence (PASS)
- API takeover/runtime pack:
  - `pnpm --filter api test -- src/modules/positions/livePositionReconciliation.service.test.ts src/modules/positions/positions.takeover-status.e2e.test.ts src/modules/orders/orders.service.test.ts src/modules/engine/runtimeSignalLoop.service.test.ts`
  - Result: PASS (`49` tests, `4` files).
- API typecheck:
  - `pnpm --filter api run typecheck`
  - Result: PASS.
- Web runtime/dashboard regression:
  - `pnpm --filter web test -- src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
  - Result: PASS (`9` tests).
- Web production build:
  - `pnpm --filter web run build`
  - Result: PASS.

## 2) VPS Public Route Probe (FAIL for strict ops gate)
- `pnpm run ops:deploy:smoke` against:
  - `https://api.soar.luckysparrow.ch`
  - `https://soar.luckysparrow.ch`
- Results:
  - `/health=200`, `/ready=200`, web root `200`
  - `/workers/health=403` (protected ops surface from public route)
- `pnpm run ops:deploy:runtime-freshness ...`:
  - HTTP `403`.
- `pnpm run ops:deploy:rollback-guard ...`:
  - `shouldRollback=true`, reasons: `runtime_freshness_endpoint_http_403`, `alerts_endpoint_http_403`.

## 3) VPS API Contract Probe (authenticated user)
- `GET /dashboard/positions/takeover-status` -> `404`
- `GET /dashboard/bots/runtime-sessions` -> `404`
- `GET /dashboard/positions?status=OPEN&page=1&limit=50` -> `200` with `10` OPEN rows
  - sampled imported row: `origin=EXCHANGE_SYNC`, `managementMode=BOT_MANAGED`, `botId=null`, `walletId=null`

## 4) Interpretation
- Local implementation confidence is green.
- Strict VPS takeover gate is not green yet for two reasons:
  1. private ops endpoints are protected from public path (`403`) and require Gate 3 execution from VPS private route,
  2. production target currently returns `404` for takeover API route, indicating missing/not-yet-deployed API revision.

## 5) Required Follow-up Before Final LIVE Sign-off
1. Deploy API revision containing `GET /dashboard/positions/takeover-status`.
2. Run strict ops checks from VPS private path using:
   - `pnpm run ops:deploy:smoke`
   - `pnpm run ops:deploy:runtime-freshness ...`
   - `pnpm run ops:deploy:rollback-guard ...`
3. Re-run canary LIVE lifecycle evidence (`OPEN -> DCA -> CLOSE`) and attach updated artifact.

## 6) Related Prior VPS Evidence
- `docs/operations/binance-live-ops-verification-2026-04-10T17-58-18-111Z.md`
- `docs/operations/_artifacts-binance-live-ops-check-2026-04-10T17-58-18-111Z.json`
