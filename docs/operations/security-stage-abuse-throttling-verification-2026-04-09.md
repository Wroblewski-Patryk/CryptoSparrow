# Stage Abuse-Throttling Verification (2026-04-09)

Task: `SAR-09 qa(stage-abuse)`

## Scope
- `POST /dashboard/profile/subscription/checkout-intents` (limit `5/min`, user scope)
- `PATCH /dashboard/profile/security/password` (limit `5/15min`, user scope)
- `DELETE /dashboard/profile/security/account` (limit `3/15min`, user scope)

## Execution Notes
- API rate-limit middleware intentionally bypasses limits when `NODE_ENV=test`.
- For deterministic QA verification, test mode for limiter was explicitly enabled with:
  - `RATE_LIMIT_ENABLE_TEST_MODE=true`
- Redis was not required for this verification path (in-memory limiter fallback).

## Commands
```bash
pnpm --filter api run typecheck
pnpm --filter api test -- src/modules/profile/stage-abuse-throttling.e2e.test.ts src/modules/profile/subscription/subscription.e2e.test.ts src/modules/profile/security/security.e2e.test.ts
pnpm run quality:guardrails
```

## Result Summary
- Typecheck: PASS
- Abuse-throttling pack: PASS
  - Checkout-intents: first 5 requests accepted (non-429), 6th request blocked (`429`)
  - Password update: first 5 requests accepted (non-429), 6th request blocked (`429`)
  - Account delete: first 3 requests accepted (non-429), 4th request blocked (`429`)
- Existing profile subscription/security contracts: PASS
- Guardrails: PASS

## Residual Risk
- This is a stage-mode simulation in CI/test context (not a deployed remote STAGE run).
- Remote edge/proxy behavior should still be re-checked during `SAR-14` rollout smoke.
