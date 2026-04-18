# Dashboard Runtime Bot Selector Parity Fix Plan (2026-04-18)

Status: queued-hotfix-after-current-wave  
Execution mode: tiny-commit only (exactly one task per commit)  
Primary audience: implementation agent

## Problem Statement
- On `/dashboard`, when user has two active bots (`PAPER` + `LIVE`), selector in runtime sidebar shows only one bot (`LIVE`).
- This blocks switching runtime context to active `PAPER` bot from dashboard.

## Confirmed Root Cause (code-level)
- In `useHomeLiveWidgetsController`, active scope is hard-clamped to `LIVE` bots when at least one `LIVE` bot exists:
  - `apps/web/src/features/dashboard-home/hooks/useHomeLiveWidgetsController.ts`
  - current logic: `activeScope = liveActive.length > 0 ? liveActive : active`
- Result: active `PAPER` bots are excluded from snapshots and from selector options.

## Target Behavior Contract
1. Dashboard selector must include all active bots (both `PAPER` and `LIVE`), up to dashboard cap.
2. Active bot mode must not filter out other active modes.
3. If active bot has no runtime session yet, it still remains selectable with degraded/no-session state.
4. Existing ordering and cap constraints remain deterministic.

## Tiny-Commit Queue

### DBSEL-01
`docs(contract): freeze dashboard selector parity contract for mixed active modes`
- Scope:
  - Document that dashboard runtime selector is mode-agnostic for active bots.
  - Document degrade behavior for active bot without session.
- Likely files:
  - `docs/planning/open-decisions.md`
  - `docs/modules/web-dashboard-home.md`
- Done when:
  - Contract explicitly states `PAPER + LIVE` coexistence in selector.

### DBSEL-02
`test(web-dashboard-red): add regression for mixed active LIVE+PAPER selector visibility`
- Scope:
  - Add/extend test in dashboard runtime UI suite to fail on current live-only clamp behavior.
  - Assert both active bots are present in selector options.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
- Done when:
  - Test is red against old behavior and captures user-reported mismatch.

### DBSEL-03
`fix(web-dashboard-controller): remove live-only active scope clamp in runtime snapshots`
- Scope:
  - Replace `LIVE`-first clamp with active-bot mode-agnostic scope.
  - Keep `MAX_DASHBOARD_BOTS` and deterministic ordering.
- Likely files:
  - `apps/web/src/features/dashboard-home/hooks/useHomeLiveWidgetsController.ts`
- Done when:
  - Snapshots are built from all active bots, not only `LIVE` when `LIVE` exists.

### DBSEL-04
`test(web-dashboard-selector-state): lock selection persistence and no-session degrade for mixed modes`
- Scope:
  - Add assertions that selected bot persistence still works when switching between `PAPER` and `LIVE`.
  - Add assertion for active bot with no session still visible/selectable.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
- Done when:
  - Mixed-mode selection path is stable and regression-safe.

### DBSEL-05
`qa(regression-pack): run focused dashboard runtime pack and publish closure note`
- Suggested commands:
  - `pnpm --filter web test -- src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
  - `pnpm --filter web run typecheck`
  - `pnpm --filter web run build`
- Done when:
  - Dashboard runtime selector parity tests and build/typecheck pass.

## Request-to-Task Mapping
- Investigation of missing `PAPER` in selector: `DBSEL-01`, `DBSEL-02`
- Code fix in dashboard runtime selection flow: `DBSEL-03`
- Stability + regression hardening: `DBSEL-04`, `DBSEL-05`
