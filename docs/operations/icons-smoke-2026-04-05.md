# Icons Manual Smoke - 2026-04-05

Task: `ICN-07 qa(web): run manual smoke for icons across Dashboard/Bots/Markets/Positions and attach evidence note`.

Environment:
- Local web app (`http://localhost:3002`)
- Playwright CLI session: `icn07`
- User: seeded account (`wroblewskipatryk@gmail.com`)

## Scope
- `/dashboard`
- `/dashboard/bots`
- `/dashboard/markets/list`
- `/dashboard/positions`

## Results
1. `/dashboard` - PASS
- Icon selector check (`img[alt$=" icon"]`): **14**
- Signal and runtime symbol icon rendering visible (cards + runtime tables).

2. `/dashboard/bots` - PASS
- Icon selector check (`img[alt$=" icon"]`): **0**
- Expected for current IA of bots list (no symbol/icon column in table rows).

3. `/dashboard/markets/list` - PASS
- Icon selector check (`img[alt$=" icon"]`): **0**
- Expected for current IA of market-group list (group-level table without per-symbol icon cells).

4. `/dashboard/positions` - PASS
- Icon selector check (`img[alt$=" icon"]`): **0**
- Snapshot had no active symbol rows at check time; fallback empty-state rendered correctly.

## Artifacts
- `output/playwright/icn07/dashboard-icons.png`
- `output/playwright/icn07/bots-list-icons.png`
- `output/playwright/icn07/markets-list-icons.png`
- `output/playwright/icn07/positions-icons.png`

## Notes
- Manual smoke confirms icon rollout is active where symbol-level UI is rendered (Dashboard control-center runtime views), with no regressions on list pages that are not icon-scoped by current UX contract.
