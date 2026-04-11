# LIVE Runtime vs Exchanges Orders/Positions Parity Audit (2026-04-10)

## Scope
Audit for `LIV-13`: verify whether legacy frontend module `Exchanges -> Orders/Positions` is still required after runtime hardening (`LIV-01..LIV-07`), before IA cleanup (`LIV-14/15`).

## Legacy Use-Cases vs Runtime Coverage
| Legacy use-case | Runtime surface | Status | Evidence |
| --- | --- | --- | --- |
| Read open positions | Dashboard runtime + Bots runtime | PASS | `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`, `apps/web/src/features/bots/components/bots-management/BotsMonitoringTab.tsx` |
| Read open orders | Bots runtime | PASS | `apps/web/src/features/bots/components/bots-management/BotsMonitoringTab.tsx` (`nowOpenOrdersTitle`) |
| Read closed positions history | Bots runtime | PASS | `apps/web/src/features/bots/components/bots-management/BotsMonitoringTab.tsx` (`historyPositionsTitle`) |
| Read trades history | Dashboard runtime + Bots runtime | PASS | `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`, `apps/web/src/features/bots/components/bots-management/BotsMonitoringTab.tsx` |
| LIVE wallet capital context (equity/free/exposure) | Dashboard runtime sidebar | PASS | `apps/web/src/features/dashboard-home/components/home-live-widgets/RuntimeSidebarSection.tsx` |
| Exchange-synced external positions visible in runtime | API runtime read-model + web runtime tables | PASS | `apps/api/src/modules/bots/botsRuntimeRead.service.ts`, `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.test.tsx` |

## Gap Check
- No blocking read-path gap found for removing `Exchanges -> Orders/Positions`.
- Per-position management policy remains backend-driven (`BOT_MANAGED` vs `MANUAL_MANAGED`) and is enforced in runtime/reconciliation paths.

## Decision
- `LIV-13` result: **Parity confirmed**.
- Proceed with IA cleanup:
  - remove menu entries for `Orders/Positions`,
  - remove obsolete routes/components/services used only by that module.
