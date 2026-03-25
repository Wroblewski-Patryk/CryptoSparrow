# V1 Local Cutover Dry-Run Report (2026-03-25)

## Context
- Generated (UTC): 2026-03-25T18:15:33.215Z
- Status: PASS
- Raw JSON: `docs\operations\_artifacts-cutover-dry-run-2026-03-25T18-15-33-215Z.json`

## Step Results
| Step | Command | Exit | Duration (ms) | Started (UTC) | Ended (UTC) |
| --- | --- | --- | --- | --- | --- |
| infra-up | `pnpm run go-live:infra:up` | 0 | 1123 | 2026-03-25T18:15:13.147Z | 2026-03-25T18:15:14.270Z |
| api-prisma-generate | `pnpm --filter api exec prisma generate` | 0 | 2192 | 2026-03-25T18:15:14.270Z | 2026-03-25T18:15:16.462Z |
| api-migrate-deploy | `pnpm --filter api exec prisma migrate deploy` | 0 | 1888 | 2026-03-25T18:15:16.462Z | 2026-03-25T18:15:18.349Z |
| api-cutover-suite | `pnpm --filter api run test src/modules/engine/runtime-flow.e2e.test.ts src/modules/backtests/backtests.e2e.test.ts src/modules/engine/preTrade.e2e.test.ts src/modules/bots/bots.e2e.test.ts` | 0 | 9638 | 2026-03-25T18:15:18.350Z | 2026-03-25T18:15:27.988Z |
| web-cutover-suite | `pnpm --filter web exec vitest run src/features/bots/components/BotsManagement.test.tsx src/features/logs/components/AuditTrailView.test.tsx` | 0 | 3677 | 2026-03-25T18:15:27.988Z | 2026-03-25T18:15:31.664Z |
| infra-down | `pnpm run go-live:infra:down` | 0 | 1550 | 2026-03-25T18:15:31.665Z | 2026-03-25T18:15:33.215Z |

## Summary
- Steps total: 6
- Failed steps: 0
- Skip infra: no
- Skip client: no
