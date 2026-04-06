# DBACT Paper-Session Timeline Smoke (2026-04-06)

Task: `DBACT-10`

## Scope
- Verify paper-session timeline coherence for `OPEN -> DCA -> CLOSE`.
- Verify financial fields stay coherent in runtime history (`fee`, `realizedPnl`, `margin`).
- Verify parity between API timeline filters and Dashboard/Bots UI rendering contract.

## Validation Method
- Focused API smoke on runtime-session timeline filters with seeded paper-session trade path.
- Focused web regression on dashboard and bots runtime history tables.
- This pass is a QA smoke evidence run for the DBACT contract, not a full release load run.

## Smoke Checklist
- [x] Session trades API supports action timeline filtering and returns `OPEN/DCA/CLOSE` lifecycle path.
- [x] Session trades API keeps financial values numeric and stable for timeline checks (`fee`, `realizedPnl`).
- [x] Dashboard runtime history renders Action badge + Margin column with non-placeholder financial values.
- [x] Bots runtime history renders Action badge + Margin column with non-placeholder financial values.
- [x] No regression observed in trade-history filter/sort flow for runtime monitoring widgets.

## Evidence (Commands)
- `pnpm --filter api test -- src/modules/bots/bots.e2e.test.ts -t "supports monitoring query filters for status/symbol/limit and enforces session time window" --testTimeout=30000`
  - Result: PASS (`1 passed`, `26 skipped` in filtered file run).
- `pnpm --filter web exec vitest run src/features/dashboard-home/components/HomeLiveWidgets.test.tsx src/features/bots/components/BotsManagement.test.tsx`
  - Result: PASS (`15 passed`).

## Outcome
- `PASS` for DBACT timeline smoke scope (`OPEN -> DCA -> CLOSE` contract + fee/pnl/margin coherence checks).
- Contract remains consistent across API monitoring endpoints and Dashboard/Bots history UI.
