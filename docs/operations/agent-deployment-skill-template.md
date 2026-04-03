# Agent Deployment Skill Template (Reusable Prompt Contract)

Use this template when delegating deployment to an AI agent.

## Goal
Deploy `<PROJECT_NAME>` from `<GIT_SHA>` to `<ENVIRONMENT>` and return with verified health + persistence checks.

## Inputs Required
1. Repository path.
2. Target SHA/branch.
3. Environment: `stage` or `production`.
4. Domains:
   - web URL,
   - api URL.
5. Platform: Coolify project/environment/service ids.
6. Critical secrets checklist (names only, never inline values).

## Agent Workflow (Non-Negotiable)
1. Read current repo state and confirm clean/dirty tree.
2. Verify target SHA exists locally and on origin.
3. Validate Dockerfile and service map (api/web/workers).
4. Confirm migration strategy for target environment.
5. Deploy in order:
   - migrations,
   - api,
   - web,
   - workers.
6. Run health checks (`/health`, `/ready`).
7. Run auth smoke checks.
8. Run persistence smoke checks (create/list on critical entities).
9. Summarize result with proof points.

## Required Smoke Contract
1. Auth:
   - login success,
   - redirect to dashboard,
   - protected endpoint returns expected user.
2. Persistence:
   - create entity returns `201`,
   - list endpoint returns created entity.
3. Runtime:
   - workers healthy and not crash-looping.

## Failure Handling Contract
1. If migration fails, stop rollout and report blocker.
2. If web/api unhealthy after deploy, trigger rollback path.
3. If only session/cookie issues appear, apply auth hardening playbook before rollback decision.
4. Always include exact failing endpoint/status in report.

## Response Format for Operator
1. Deployment status (`success`/`blocked`/`rolled back`).
2. Target SHA deployed.
3. Services touched.
4. Health check results.
5. Smoke check results.
6. Risks or follow-up actions.

## Copy/Paste Prompt Starter
```text
Deploy <PROJECT_NAME> to <ENVIRONMENT> in Coolify using SHA <GIT_SHA>.
Validate api/web/workers, run migrations, then run auth + persistence smoke checks.
If any critical gate fails, stop and report exact blocker with endpoint/status.
Return final status, evidence summary, and next actions.
```

