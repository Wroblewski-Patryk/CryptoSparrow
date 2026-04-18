# Deployment Agent Checklist Template

## Mission
Deploy `CryptoSparrow / Soar` to `<ENV>` using SHA `<SHA>` and return only
after API, web, worker, and smoke validation is complete.

## Inputs
1. Repo path
2. SHA or branch
3. Environment (`stage` or `production`)
4. API URL
5. Web URL
6. Worker service map or deployment topology
7. Database and Redis connection ownership

## Required Execution Order
1. Verify SHA and repo state.
2. Verify env variables, secrets, and service routing.
3. Run migrations and startup checks.
4. Deploy API, web, and worker services.
5. Run health and readiness checks.
6. Run post-deploy smoke for one authenticated dashboard flow and one runtime
   or worker-sensitive path.
7. Report outcome.

## Health And Smoke Commands
1. `/health`
2. `/ready`
3. `/workers/health`
4. one authenticated dashboard flow
5. one route or runtime smoke relevant to the release scope

## Stop Conditions
1. migration or startup failure
2. health or readiness endpoint not green
3. worker topology mismatch or stale runtime freshness
4. authenticated smoke fails
5. rollback guard triggers

## Output Contract
1. Final status (`success`, `blocked`, `rolled_back`)
2. Deployed SHA
3. Passed or failed checks
4. Exact failing endpoint or error if blocked
5. Recommended next action
