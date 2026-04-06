# V1 Secrets Inventory

Purpose: canonical inventory of production-relevant secrets, their owners, and rotation cadence.

## Ownership Model
- Security owner: validates policy and rotation compliance.
- Ops owner: maintains runtime/platform secret stores and rollout procedure.
- Backend owner: validates application compatibility (startup, auth, encryption keyring).

## Runtime Secrets (API/Web)
| Secret | Environment key(s) | Primary owner | Rotation cadence | Notes |
| --- | --- | --- | --- | --- |
| JWT signing secret (active) | `JWT_SECRET` | Backend owner | every 30 days or immediate on incident | Required at startup and `/ready`. |
| JWT signing secret (previous) | `JWT_SECRET_PREVIOUS`, `JWT_SECRET_PREVIOUS_UNTIL` | Backend owner | per rotation window (max 14 days overlap) | Enables in-flight token migration. |
| API-key encryption keyring | `API_KEY_ENCRYPTION_KEYS` | Security owner | every 60 days | Versioned `version:key` map; supports gradual key migration. |
| Active encryption version selector | `API_KEY_ENCRYPTION_ACTIVE_VERSION` | Security owner | on each key rotation | Must point to present key version. |
| Legacy API-key encryption fallback (migration only) | `API_KEY_ENCRYPTION` | Backend owner | disable after migration | Compatibility-only, not recommended in steady state. |
| Cookie/sign-in security context | `COOKIE_DOMAIN` (optional) | Backend owner | on domain/scope changes | Not a secret by itself; listed due auth boundary impact. |
| Web auth middleware secret | `apps/web/.env.local:JWT_SECRET` | Frontend owner | synced with backend rotation policy | Used for web-side auth middleware/session checks. |

## Platform and Integration Secrets
| Secret | Environment key(s) | Primary owner | Rotation cadence | Notes |
| --- | --- | --- | --- | --- |
| Database credentials | `DATABASE_URL`, `STAGE_DATABASE_URL` | Ops owner | every 90 days | Rotate with restore drill evidence and migration compatibility check. |
| Redis credentials | `REDIS_URL` | Ops owner | every 90 days | Validate queue/readiness after change. |
| CoinGecko API key (optional) | `COINGECKO_API_KEY` | Ops owner | every 180 days | Required if target environment enforces vendor key auth. |
| Stage deploy webhook | `COOLIFY_STAGE_DEPLOY_HOOK_URL` | Ops owner | every 90 days | GitHub Actions secret. |
| Prod deploy webhook | `COOLIFY_PROD_DEPLOY_HOOK_URL` | Ops owner | every 90 days | GitHub Actions secret. |
| Prod rollback webhook | `COOLIFY_PROD_ROLLBACK_HOOK_URL` | Ops owner | every 90 days | Must be tested by rollback drill. |

## Rotation Readiness Rules
1. Any rotation touching `JWT_SECRET` or `API_KEY_ENCRYPTION_KEYS` must pass startup/readiness validation before release.
2. JWT rotation must include bounded overlap window via `JWT_SECRET_PREVIOUS_UNTIL`.
3. Keyring rotation must update `API_KEY_ENCRYPTION_ACTIVE_VERSION` only after new key material is present.
4. Database/redis secret rotation requires post-change `health`, `ready`, and worker readiness checks.
5. All rotations require evidence links in RC artifacts or incident record.

## Evidence and Audit Trail
- RC checklist: `docs/operations/v1-release-candidate-checklist.md`
- RC gates runbook: `docs/operations/v1-rc-external-gates-runbook.md`
- Ops runbook: `docs/operations/v1-ops-runbook.md`
- Security baseline docs:
  - `docs/security/security-and-risk.md`
  - `docs/security/api-key-lifecycle-policy.md`
