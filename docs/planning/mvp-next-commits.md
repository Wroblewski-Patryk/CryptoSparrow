# MVP Next Commits Queue

Operational queue for one-task execution runs.

## Start Intent
- User sends any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`).
- Agent executes exactly one unchecked task from `NOW`.

## NOW

## NEXT
- [ ] `feat(runtime-scans): add configurable interval + market filters for periodic market/position scans`
- [ ] `test(e2e): expand end-to-end strategy -> backtest -> paper -> live opt-in runtime assertions`
- [ ] `docs(sync): update current limitations/scope after SSE fan-out and runtime-loop completion`

## BLOCKED
- [ ] `exit-gates(v1-production): SLO/incident/security/load/public-docs/launch-review criteria require production evidence and launch-cycle checkpoints`

## DONE
- [x] `chore(planning): initialize MVP/V1 execution plans and agent blueprint`
- [x] `chore(planning): align trigger intent to generic one-task nudge`
- [x] `chore(planning): historical done backlog archived in git history; queue reset for current delivery focus`
- [x] `audit(reverify): confirm upload endpoint auth + MIME/size limits with regression test coverage`
- [x] `audit(reverify): confirm LIVE consentTextVersion persistence across schema/DTO/API/audit flow`
- [x] `feat(stream-fanout): wire server-owned SSE fan-out endpoint from market-stream worker to dashboard`
- [x] `feat(runtime-loop): complete continuous stream -> signal evaluation loop in worker runtime`
- [x] `chore(release): re-run MVP release checklist and store evidence after freeze-gap closure`
- [x] `audit(reverify): re-validate P0/P1 audit findings in code and tests before further expansion`
- [x] `feat(runtime-management): support managed lifecycle for manually opened Binance Spot/Futures positions`
- [x] `feat(runtime-management): ensure DCA/SL/TP/TSL automation until close in runtime loop`

## Queue Rules
- Keep `NOW` at max 5 tasks.
- Keep one logical change per task.
- If task grows, split before coding.
- After completion, update this file and `docs/planning/mvp-execution-plan.md`.
