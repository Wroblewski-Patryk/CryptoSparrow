# Deployment Rollback Playbook (App/Env/Workers)

Date: 2026-04-03  
Scope: Controlled rollback procedure for failed STAGE/PROD rollout.

## Goal
Restore stable service quickly when deployment or post-deploy health gates fail.

## Rollback Triggers
Execute rollback when any required condition occurs:
1. API readiness stays red beyond rollout timeout.
2. Web is unavailable or fails critical smoke checks.
3. Worker runtime enters crash-loop or queue processing is stalled.
4. Migration causes incompatible runtime behavior.
5. Security/compliance gate fails and requires immediate revert.

## Ownership During Incident
- **Incident commander (on-call/release owner)**: declares rollback.
- **Ops executor**: performs environment/service rollback actions.
- **Backend owner**: validates API/workers recovery.
- **Frontend owner**: validates web recovery.

## Rollback Modes

### A) App Version Rollback (preferred)
Use previous stable deployment artifact/tag for:
- `api`,
- `web`,
- `workers` (same compatible set).

### B) Environment Rollback
If issue is configuration-only:
- restore previous env variable set,
- redeploy unchanged stable app artifact.

### C) Worker-Only Rollback
If web/api are healthy and issue is isolated to workers:
- rollback/restart worker services only,
- keep web/api online.

## Automation Entry Point
- Workflow: `.github/workflows/prod-rollback.yml`
- Trigger: failed completion of `Promote PROD` (and manual dispatch)
- Required secret: `COOLIFY_PROD_ROLLBACK_HOOK_URL`

## Standard Rollback Procedure
1. Freeze promotion pipeline for affected environment.
2. Identify last known stable release reference (tag/artifact/SHA).
3. Execute rollback mode (A/B/C).
4. Re-run required post-rollback checks:
   - API `/health` + `/ready`,
   - web root + auth smoke,
   - workers readiness + queue heartbeat.
5. Mark incident status:
   - `ROLLED_BACK`,
   - `STABLE_RESTORED` (after all checks green).

## Migration-Aware Guard
If failed release included schema migration:
1. Prefer rollback to app version that remains compatible with current schema.
2. If schema rollback is required, execute only with approved rollback script and backup checkpoint.
3. Never run destructive schema rollback ad hoc in active incident without explicit approval.

## Communication Template
Minimum incident update includes:
- environment (`stage`/`prod`),
- failing SHA,
- rollback target SHA/tag,
- affected services,
- ETA for stabilization,
- current gate status.

## Evidence Requirements
For each rollback event capture:
- trigger reason,
- decision timestamp,
- executor identity,
- target rollback version/env snapshot,
- post-rollback gate results,
- final service state.

Attach evidence to release records and postmortem workflow.

## Exit Criteria
Incident may be closed only when:
1. rollback target is stable,
2. required health/smoke gates are green,
3. promotion pipeline remains blocked until fix SHA is validated on STAGE.
