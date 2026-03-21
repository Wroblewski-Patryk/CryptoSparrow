# Full Commit Roadmap (MVP + V1 + Local Replacement)

This roadmap is commit-sized and intended for continuous execution by agents.
Each item should be delivered as one logical commit unless split is explicitly required.

## Track A - Local Replacement Gate (Must Pass First)
- [ ] `docs(sync): reconcile roadmap immediate gaps with implemented runtime-stream status and evidence links`
- [ ] `ops(slo): define MVP/V1 SLO targets and measurable thresholds`
- [ ] `ops(evidence): capture baseline load run results and attach to evidence pack`
- [ ] `security(audit): publish ownership/auth/key-flow verification summary`
- [ ] `release(evidence): compile launch-readiness evidence checklist`
- [ ] `ops(cutover): define local cutover checklist from legacy bot to new runtime`
- [ ] `ops(cutover): add rollback checklist for fallback to legacy runtime`
- [ ] `test(cutover): run local replacement dry-run with real-world bot scenario`

## Track B - MVP Hard Close
- [ ] `docs(mvp): lock MVP status as complete with linked proof artifacts`
- [ ] `chore(release): finalize MVP tag notes and migration hints`

## Track C - V1 Exit Evidence Workpack
- [ ] `ops(slo): collect production observation window for SLO validation`
- [ ] `test(drill): execute production-like incident drills and record outcomes`
- [ ] `security(audit): finalize auth/ownership/key audit sign-off`
- [ ] `test(load): publish load/performance pass report against thresholds`
- [ ] `docs(public): finalize user/operator public launch docs pack`
- [ ] `release(review): complete launch retrospective and cut V1.1 backlog`

## Track D - Post-MVP/V1 Expansion Planning
- [ ] `post-mvp(admin): owner admin panel milestone plan (pricing/subscriptions/settings)`
- [ ] `post-mvp(billing): rollout plan for monthly/annual + fiat/crypto payments`
- [ ] `post-mvp(exchange): adapter rollout plan for exchanges beyond Binance`
- [ ] `post-mvp(mobile): decision checkpoint for native mobile vs PWA continuation`

## Definition of Done (Roadmap)
- Every completed item has:
  - linked PR/commit,
  - validation evidence (test/report/doc),
  - updated status in `mvp-execution-plan.md`, `mvp-next-commits.md`, and `v1-live-release-plan.md`.
