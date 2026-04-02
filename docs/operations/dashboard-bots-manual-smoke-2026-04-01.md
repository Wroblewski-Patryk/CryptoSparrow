# Dashboard -> Bots Final Smoke Notes (2026-04-01)

Task: `BOPS-35`
Scope: final smoke for UX flow between global Dashboard (`/dashboard`) and Bots runtime (`/dashboard/bots`), with validation notes for the next polish task (`BOPS-36`).

## Validation Method
- Local runtime check: API (`:3001`) and WEB (`:3002`) started successfully.
- Focused regression suite:
  - `src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
  - `src/features/bots/components/BotsManagement.test.tsx`
  - `src/ui/layout/dashboard/Header.responsive.test.tsx`
- Production build check:
  - `pnpm --filter web build`

## Results
- Regression tests: `PASS` (`12/12`).
- Web build: `PASS` (Next build green; only existing hook dependency warnings).
- Dashboard/Bots route runtime availability: `PASS` (both ports listening and pages reachable in local app runtime).

## UX Smoke Outcome
Overall status: `PASS with nits` (ready for `BOPS-36` polish commit).

### A) Dashboard first-load orientation
- PASS: control-center remains clear and fast to scan.
- PASS: no major duplication in top-level status language after recent cleanup.

### B) Dashboard -> Bots handoff clarity
- PASS: handoff path is explicit (main nav + runtime module access).
- PASS: no IA confusion (Dashboard as control-center, Bots as runtime operations).

### C) Bots IA (Now / History / Live checks)
- PASS: section split is understandable for operator workflow.
- PASS: tables are readable and aligned with recent simplifications.

### D) Creator form usability
- PASS: 3-section structure is intact.
- PASS: mode-specific fields remain conditional as expected.

### E) Visual quality / accessibility
- PASS: no blocking responsive regressions surfaced by test set.
- PASS: nav responsive contract remains green.

## Nits Captured for `BOPS-36`
1. `S2` Sidebar density polish:
   - Risk/runtime block still feels visually heavy on long sessions.
   - Improve card rhythm and whitespace while keeping the same data contract.
2. `S2` Live-check cards:
   - Condition presentation should be cleaner under `NEUTRAL` state.
   - Keep always-on conditions + live values but reduce visual clutter.
3. `S3` Microcopy consistency:
   - Re-check short labels for mixed verbosity (runtime sidebar vs live-check cards).
4. `S3` Optional metrics trim:
   - Keep only decision-driving metrics in dashboard view to reduce cognitive load.

## Commands Executed
```bash
pnpm --filter web test -- src/features/dashboard-home/components/HomeLiveWidgets.test.tsx src/features/bots/components/BotsManagement.test.tsx src/ui/layout/dashboard/Header.responsive.test.tsx
pnpm --filter web build
```

## Handoff
- `BOPS-35` can be treated as completed.
- Next tiny task: `BOPS-36` (apply focused UX nits from this note and freeze for wider QA).
