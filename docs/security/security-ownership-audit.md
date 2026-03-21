# Security Ownership Audit (V1 Baseline)

Date: 2026-03-16

## Objective
Confirm that sensitive user-scoped actions enforce ownership boundaries.

## Covered Modules
- Strategies: owner-only get/update/delete paths.
- Markets: owner-scoped CRUD.
- Bots: owner-scoped CRUD and live-control fields.
- Backtests: run/list/get and strategy ownership validation.
- Orders/Positions: owner-scoped reads.
- API Keys: owner-scoped update/delete + rotate/revoke lifecycle actions.
- Profile Basic: self-only read/update/delete route (`/dashboard/profile/basic`).

## Security Controls Verified
- Service-level lookups use `id + userId` or equivalent owner-scoped pre-checks.
- Foreign-resource access returns not-found semantics for protected mutations.
- Auth middleware requires valid signed token with strict claims.
- Sensitive outputs redact secrets/password hashes.

## Residual Gaps
- Full static ownership-rule linting is not yet automated.
- Worker-side ownership checks will require additional review once worker split is introduced.
