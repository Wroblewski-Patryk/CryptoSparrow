# Coolify Trigger Wiring (Stage + Prod + Rollback)

Date: 2026-04-03  
Task: `DPL-18 ops(coolify)`

## Goal
Wire deployment triggers between GitHub Actions and Coolify services for:
- STAGE deploy,
- PROD promote deploy,
- PROD rollback.

## Required GitHub Secrets
Configure repository secrets:

1. `COOLIFY_STAGE_DEPLOY_HOOK_URL`
   - consumed by: `.github/workflows/deploy-stage.yml`
2. `COOLIFY_PROD_DEPLOY_HOOK_URL`
   - consumed by: `.github/workflows/promote-prod.yml`
3. `COOLIFY_PROD_ROLLBACK_HOOK_URL`
   - consumed by: `.github/workflows/prod-rollback.yml`
4. `STAGE_API_BASE_URL`
   - consumed by: `.github/workflows/stage-gates.yml`
5. `STAGE_WEB_BASE_URL`
   - consumed by: `.github/workflows/stage-gates.yml`
6. `STAGE_DATABASE_URL`
   - consumed by: `.github/workflows/stage-gates.yml` (migration gate)

## Coolify Side Setup
For each target service/app in Coolify:
1. Open service -> Deployments/Webhooks.
2. Create deployment webhook for STAGE stack.
3. Create deployment webhook for PROD stack.
4. Create rollback webhook for PROD (previous stable deployment path).
5. Copy webhook URLs into matching GitHub repository secrets.

## Workflow Chain Contract
1. `deploy-stage.yml`
   - trigger: push to `develop`
   - action: deploy STAGE via Coolify webhook
2. `stage-gates.yml`
   - trigger: successful `Deploy STAGE`
   - action: run gate pack + report artifact
3. `promote-prod.yml`
   - trigger: successful `Stage Gates`
   - action: deploy same verified SHA to PROD
4. `prod-rollback.yml`
   - trigger: failed `Promote PROD`
   - action: trigger rollback webhook to previous stable release

## Payload Contract (Webhook Body)
Current workflows pass JSON payload with metadata:
- SHA/ref/repository/actor/environment,
- plus failure metadata for rollback.

Coolify may ignore extra fields, but they are preserved for future custom automation.

## Smoke Validation After Wiring
1. Trigger manual `Deploy STAGE` workflow_dispatch.
2. Confirm Stage deployment starts in Coolify.
3. Trigger/observe `Stage Gates` and verify artifact upload.
4. Trigger manual `Promote PROD` workflow_dispatch in controlled window.
5. Validate PROD deployment appears in Coolify.
6. Simulate failed promotion path (non-prod safe test) and verify rollback webhook fires.

## Security Notes
- Webhook URLs are secrets; never store in repo.
- Restrict who can run `workflow_dispatch` on production workflows.
- Use protected environments (`stage`, `production`) with required reviewers where appropriate.
