# MVP Next Commits Queue

Operational queue for one-task execution runs.

## Start Intent
- User sends any short "start work" nudge (`rob`, `rób`, `dzialaj`, `start`, `go`, `next`).
- Agent executes exactly one unchecked task from `NOW`.

## NOW
- [x] `docs(decisions): resolve preset storage approach for MVP`
- [x] `refactor(validation): centralize zod error formatting`
- [x] `fix(server): reduce critical any usage in auth/middleware`
- [ ] `fix(client): reduce critical any usage in strategy/profile flows`
- [ ] `test(strategies): add strategy CRUD contract tests`

## NEXT
- [ ] `security(api-keys): verify encrypted-only storage and masked response`
- [ ] `security(rate-limit): add limiter for auth, market, and trading endpoints`
- [ ] `docs(cleanup): normalize encoding and Current/Planned consistency`
- [ ] `docs(ui): audit legacy CryptoBot dashboard patterns for positions/orders and control-center IA`
- [ ] `feat(ui): post-login control-center dashboard with positions/orders snapshot widgets`
- [ ] `feat(db): add MarketUniverse model`
- [ ] `feat(db): add SymbolGroup model`

## BLOCKED
- [ ] (empty)

## DONE
- [ ] 2026-03-15 `chore(planning): initialize MVP/V1 execution plans and agent blueprint`
- [ ] 2026-03-15 `chore(planning): align trigger intent to generic one-task nudge`
- [x] 2026-03-15 `chore(repo): add root workspace scripts for lint/typecheck/test/build`
- [x] 2026-03-15 `chore(ci): add minimal CI checks for client and server`
- [x] 2026-03-15 `docs(decisions): freeze MVP strategy schema shape in open-decisions/product docs`
- [x] 2026-03-15 `refactor(api): unify API error response payload`
- [x] 2026-03-15 `test(auth): stabilize deterministic auth regression tests`
- [x] 2026-03-15 `docs(decisions): resolve preset storage approach for MVP`
- [x] 2026-03-15 `refactor(validation): centralize zod error formatting`
- [x] 2026-03-15 `fix(server): reduce critical any usage in auth/middleware`

## Queue Rules
- Keep `NOW` at max 5 tasks.
- Keep one logical change per task.
- If task grows, split before coding.
- After completion, update this file and `docs/mvp-execution-plan.md`.
