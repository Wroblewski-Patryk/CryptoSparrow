# CI Auto-Promotion Security Hardening

Date: 2026-04-03  
Task: `DPL-19 security(ci)`

## Goal
Reduce risk of unsafe deployment promotion by hardening branch protections, workflow ownership, and secret handling.

## Implemented Repository Controls
1. `CODEOWNERS` added at `.github/CODEOWNERS`:
   - default ownership enforced,
   - CI/CD workflow and deployment docs paths require owner review.
2. CI workflow permissions reduced:
   - `.github/workflows/ci.yml` uses `permissions: contents: read`.
3. Stage/Prod deployment workflows already rely on explicit secrets and protected environments:
   - `deploy-stage.yml`,
   - `stage-gates.yml`,
   - `promote-prod.yml`,
   - `prod-rollback.yml`.

## Required GitHub Branch Protection (Settings)
Apply in GitHub repository settings:

### `main`
- Require pull request before merge.
- Require approvals (recommended: at least 1).
- Require status checks to pass before merge:
  - `Web checks`,
  - `API checks`.
- Restrict direct pushes.
- Disallow force pushes.
- Disallow branch deletion.

### `develop` (integration branch)
- Restrict direct pushes to trusted maintainers or PR-only flow.
- Require status checks for deployment chain health:
  - `Deploy STAGE`,
  - `Stage Gates`.
- Disallow force pushes.

## Required Environment Protection

### `stage` environment
- Limit who can approve/rerun workflows.
- Keep stage secrets isolated from production values.

### `production` environment
- Require manual reviewers for sensitive workflows where needed.
- Allow only trusted maintainers to run manual dispatch.
- Enforce separate production-only secrets.

## Secret Hardening Rules
1. Store only in GitHub Secrets/Environment Secrets.
2. Never commit secret values into repository files or workflow YAML.
3. Use distinct values per environment (`stage` vs `production`).
4. Rotate webhook URLs/credentials after incidents or quarterly.
5. Audit workflows for secret usage before enabling new automation links.

## Verification Checklist
- [ ] `CODEOWNERS` present and active.
- [ ] Branch protection enabled for `main` and `develop`.
- [ ] `stage` and `production` environments configured with protections.
- [ ] Required secrets exist:
  - `COOLIFY_STAGE_DEPLOY_HOOK_URL`
  - `COOLIFY_PROD_DEPLOY_HOOK_URL`
  - `COOLIFY_PROD_ROLLBACK_HOOK_URL`
  - `STAGE_DATABASE_URL`
  - `STAGE_API_BASE_URL`
  - `STAGE_WEB_BASE_URL`
- [ ] Deployment chain run completed with green `Stage Gates`.
