# Auth Smoke Evidence (2026-03-21)

## Scope
- failed login
- successful login
- logout behavior (cookie clear instruction)
- protected route redirect to login

## Environment
- `pnpm go-live:infra:up` (postgres + redis)
- local server/client dev runtime

## Evidence Artifact
- `docs/operations/_artifacts-auth-smoke-2026-03-21.json`

## Result Summary
- register user: `201` (`PASS`)
- failed login returns `401` (`PASS`)
- successful login returns `200` with session cookie (`PASS`)
- post-login session check `/auth/me` returns `200` (`PASS`)
- logout returns cookie clear instruction (`PASS`)
- protected route `/dashboard` redirects to `/auth/login` (`307`) (`PASS`)

Overall: `PASS`
