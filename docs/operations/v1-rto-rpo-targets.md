# V1 RTO/RPO Targets

Purpose: define recovery-time and recovery-point targets with explicit acceptable degradation windows for runtime operations.

## Definitions
- RTO (Recovery Time Objective): maximum allowed time to restore acceptable service.
- RPO (Recovery Point Objective): maximum tolerated data loss window.

## Service Classes
| Service class | Scope | Target RTO | Target RPO | Acceptable degradation window |
| --- | --- | --- | --- | --- |
| Critical trading control plane | API auth/readiness, runtime worker control loop, safety guards | 15 minutes | 5 minutes | Up to 10 minutes degraded (read-only + no new live order opens) |
| Runtime execution data path | signal evaluation, order orchestration, position automation | 20 minutes | 2 minutes | Up to 15 minutes degraded with live opening paused and close/cancel path prioritized |
| Market stream ingestion | market data freshness and stream fanout | 10 minutes | 1 minute | Up to 5 minutes degraded before rollback guard triggers |
| Operator dashboards | web app routes and runtime visibility panels | 30 minutes | 15 minutes | Up to 30 minutes degraded with API still healthy |
| Non-critical analytics | reports, historical exports, assistant diagnostics | 24 hours | 1 hour | Defer recovery to next maintenance window when core runtime is green |

## Incident Mode Policy
1. When critical-path degradation exceeds acceptable window, freeze promotion and activate rollback guard.
2. During degraded mode:
   - block risky live actions,
   - keep close/cancel and protective paths available,
   - publish operator status every 15 minutes for SEV-1/SEV-2.
3. Exit degraded mode only after:
   - runtime freshness checks return PASS,
   - worker and API readiness are stable,
   - incident commander records recovery timestamp.

## Evidence Requirements
- Capture start/end UTC for each incident and calculate observed RTO.
- Attach backup/restore artifacts for data-recovery incidents.
- Record estimated data-loss window and observed RPO in post-incident notes.

## Linked Docs
- `docs/operations/deployment-rollback-playbook.md`
- `docs/operations/runtime-incident-triage-matrix.md`
- `docs/operations/v1-rc-external-gates-runbook.md`
