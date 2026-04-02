# Deployment Incident Playbook (Blocked Promotion / Stage / Prod Failure)

Date: 2026-04-03  
Task: `DPL-20 docs(runbook)`

## Goal
Provide a deterministic response flow when deployment promotion is blocked or when STAGE/PROD rollout fails.

## Incident Classes
1. **Blocked promotion**
   - stage gate pack did not pass,
   - or evidence/sign-off requirements are incomplete.
2. **Failed STAGE rollout**
   - deploy trigger failed,
   - stage health/smoke regression.
3. **Failed PROD rollout**
   - promote-prod failed,
   - post-deploy health failure,
   - rollback triggered or required.

## Core Roles
- **Incident Commander (IC)**: coordinates timeline and go/no-go decisions.
- **Ops Executor**: handles Coolify/GitHub workflow actions.
- **Backend/Frontend Owners**: triage API/web/workers symptoms and fix scope.
- **Release Owner**: approves resume of promotion path.

## Shared Triage Checklist (All Classes)
1. Capture failing SHA, workflow run ID, environment.
2. Retrieve latest artifacts:
   - `stage-gates-report.json` / `.md`,
   - promote/rollback workflow logs.
3. Confirm current service state:
   - API `/health` + `/ready`,
   - web root and dashboard route,
   - workers health/ready.
4. Classify blast radius:
   - stage only,
   - production impact,
   - worker-only degradation.

## Playbook A: Blocked Promotion
1. Set release status to `PROMOTION_BLOCKED`.
2. Identify failing gate(s) from stage report artifact.
3. Assign owner per failing gate:
   - build/test -> engineering owner,
   - migration -> backend/db owner,
   - health/smoke -> ops + app owners.
4. Prepare fix commit SHA.
5. Re-run chain:
   - deploy stage -> stage gates -> promote prod.
6. Keep PROD unchanged until new SHA passes all gates.

## Playbook B: Failed STAGE Rollout
1. Mark incident `STAGE_FAILED`.
2. Pause promotion chain for current SHA.
3. Recover STAGE:
   - redeploy known-good stage SHA or fix config,
   - re-run stage health/smoke.
4. Validate gate pack is green before re-enabling promotion path.

## Playbook C: Failed PROD Rollout
1. Mark incident `PROD_FAILED`.
2. Confirm whether `prod-rollback` workflow already executed.
3. If rollback did not execute, trigger rollback manually.
4. Validate post-rollback stability:
   - API ready,
   - web reachable,
   - workers healthy.
5. Freeze promotion of failing SHA.
6. Create remediation issue and require new validated SHA through STAGE path.

## Communication Contract
Every incident update must include:
- incident class,
- affected environment,
- failing SHA/run id,
- current status (`investigating`, `mitigating`, `stable_restored`),
- next action + owner + ETA.

## Exit Criteria
Incident may close only when:
1. impacted environment is stable,
2. required gates are green for active serving version,
3. incident evidence is attached to release logs,
4. release owner approves reopening normal promotion flow.

## Evidence to Attach
- Gate reports,
- Workflow logs (deploy/stage-gates/promote/rollback),
- Timestamped decisions,
- Final root-cause summary and prevention action list.

## Related Contracts
- `docs/operations/dev-stage-prod-promotion-contract.md`
- `docs/operations/deployment-readiness-gates.md`
- `docs/operations/deployment-rollback-playbook.md`
- `docs/operations/post-deploy-smoke-checklist.md`
