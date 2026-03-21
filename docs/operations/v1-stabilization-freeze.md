# V1 Stabilization Freeze and Bug Bash Plan

## Freeze Window
- Duration: 5 business days before planned `v1.0` tag.
- Scope freeze:
  - no new feature merges,
  - only bug fixes, security patches, and release blockers.
- Approval rule:
  - each freeze-period merge requires explicit release-owner approval.

## Bug Bash Program

### Objectives
- Catch regressions in live-critical paths.
- Validate operational readiness under realistic operator usage.
- Prioritize high-impact issues before release tag.

### Roles
- Release owner: final go/no-go decision.
- QA lead: coordinates test sessions and triage.
- Engineering on-duty: fixes P0/P1 immediately.
- Ops representative: validates runbooks and incident handling.

### Test Focus Areas
1. Strategy flow:
   - create/import,
   - backtest,
   - bot attach/update.
2. Live-safety flow:
   - LIVE confirmations,
   - consent handling,
   - kill-switch and emergency actions.
3. Observability flow:
   - metrics and alerts,
   - logs decision trace,
   - worker health/readiness.
4. Localization/accessibility:
   - EN/PL parity checks,
   - keyboard and screen-reader sanity checks.

### Severity and SLA During Bash
- P0: immediate fix, same-day retest.
- P1: fix within 24h, mandatory retest.
- P2: fix before tag if low risk and scoped.
- P3: capture in v1.1 backlog unless grouped with critical areas.

## Exit Criteria
- No open P0/P1 defects.
- All RC checklist gates reviewed (`docs/operations/v1-release-candidate-checklist.md`).
- Freeze-period fixes verified in both automated and manual checks.
