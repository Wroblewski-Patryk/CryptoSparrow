# Subscription Admin + Billing Provider Runbook

Status: active (`SUBS-12`, 2026-04-07)

## Purpose
- Provide one operator playbook for:
  - editing subscription plans (price + entitlements),
  - manually assigning plans to users,
  - switching checkout provider strategy without refactoring domain logic.

## Current V1 Capabilities
- Canonical plans: `FREE`, `ADVANCED`, `PROFESSIONAL`.
- Profile read endpoint: `GET /dashboard/profile/subscription`.
- Checkout-intent endpoint: `POST /dashboard/profile/subscription/checkout-intents`.
- Admin plans API (ADMIN only):
  - `GET /admin/subscriptions/plans`
  - `PUT /admin/subscriptions/plans/:code`
- Provider adapters currently implemented:
  - `MANUAL` (default)
  - `STRIPE`
- Reserved (not implemented yet): `KLARNA`, `OTHER`.

## Preconditions
- API and web are running.
- Operator account has `ADMIN` role.
- DB migration/seed state is up to date (`SubscriptionPlan`, `UserSubscription`, `PaymentIntent` tables present).

## A. Edit Plan Limits and Pricing

### A1. Recommended path (Admin UI)
1. Open `web` admin view: `/admin/subscriptions`.
2. Use `Edit` for selected plan.
3. Update supported fields:
   - `monthlyPriceMinor`
   - `currency`
   - `maxBotsTotal`
   - `maxBotsByMode.PAPER`
   - `maxBotsByMode.LIVE`
   - `maxConcurrentBacktests`
4. Save and confirm updated values in table.

### A2. API path (automation/fallback)
`PUT /admin/subscriptions/plans/:code`

Example payload:

```json
{
  "monthlyPriceMinor": 9900,
  "currency": "USD",
  "entitlements": {
    "version": 1,
    "limits": {
      "maxBotsTotal": 5,
      "maxBotsByMode": { "PAPER": 5, "LIVE": 3 },
      "maxConcurrentBacktests": 5
    },
    "features": {
      "liveTrading": true,
      "syncExternalPositions": true,
      "manageExternalPositions": true
    },
    "cadence": {
      "allowedIntervals": ["1m", "5m", "15m", "30m", "1h"],
      "defaultMarketScanInterval": "5m",
      "defaultPositionScanInterval": "5m"
    }
  }
}
```

Validation guardrails:
- currency must be 3-letter ISO code,
- numeric limits must be non-negative (backtests `>= 1`),
- mode limits cannot exceed `maxBotsTotal`.

### A3. Post-change verification
1. `GET /admin/subscriptions/plans` -> confirm persisted values.
2. For affected user, `GET /dashboard/profile/subscription` -> confirm active plan + catalog payload.
3. Entitlement sanity smoke:
   - create bot above plan cap -> expect `409`,
   - create bot within cap -> expect `201`.

## B. Manual Plan Assignment (Admin Override)

Note: V1 has no dedicated admin endpoint for changing another user subscription directly.
Use controlled one-off operator command below.

### B1. One-off assignment command (recommended)
Run from repository root:

```bash
pnpm --filter api exec tsx -e "import { prisma } from './src/prisma/client'; import { ensureSubscriptionCatalog, setActiveSubscriptionForUser } from './src/modules/subscriptions/subscriptions.service'; const email='user@example.com'; const planCode='PROFESSIONAL' as const; const user=await prisma.user.findUnique({ where:{ email }, select:{ id:true } }); if(!user) throw new Error('USER_NOT_FOUND'); await ensureSubscriptionCatalog(prisma); await setActiveSubscriptionForUser(prisma,{ userId:user.id, planCode, source:'ADMIN_OVERRIDE', autoRenew:false, metadata:{ actor:'admin', note:'manual override' } }); await prisma.$disconnect();"
```

### B2. Verify assignment
1. Login as target user.
2. `GET /dashboard/profile/subscription`.
3. Confirm:
   - `activePlanCode` matches target plan,
   - `activeSubscription.source === "ADMIN_OVERRIDE"`,
   - previous active subscription is no longer active.

## C. Payment Provider Switch Strategy

### C1. Supported provider values
- `SUBSCRIPTION_PAYMENT_PROVIDER=MANUAL` (default, safest fallback).
- `SUBSCRIPTION_PAYMENT_PROVIDER=STRIPE` (requires Stripe env keys).

### C2. Switch to Stripe
1. Set env values:
   - `SUBSCRIPTION_PAYMENT_PROVIDER=STRIPE`
   - `STRIPE_SECRET_KEY=...`
   - `STRIPE_PRICE_ID_ADVANCED_MONTHLY=...`
   - `STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=...`
2. Restart API service.
3. Smoke test as authenticated user:
   - `POST /dashboard/profile/subscription/checkout-intents` with `planCode: "ADVANCED"`.
   - Expect `201`, `provider: "STRIPE"`, non-null `checkoutUrl`.

### C3. Fast rollback to MANUAL
1. Set `SUBSCRIPTION_PAYMENT_PROVIDER=MANUAL`.
2. Restart API service.
3. Repeat checkout-intent smoke:
   - expect `provider: "MANUAL"` and deterministic response.

### C4. Error mapping reference
- `503`: provider not configured / Stripe key missing / Stripe price missing.
- `501`: provider enum configured but adapter not implemented.
- `400`: non-payable plan selected (`FREE`).
- `404`: subscription plan missing in catalog.

## D. Safety Rules
- Never edit plan payload directly in DB without preserving schema contract.
- Keep one active subscription per user invariant.
- Prefer `ADMIN_OVERRIDE` source for manual operator actions.
- Always capture actor + reason in assignment metadata.
- For production changes: apply in stage first, run checkout smoke, then promote.

## References
- Contract: `docs/architecture/subscription-tier-entitlements-contract.md`
- Rollout plan: `docs/planning/subscription-entitlements-rollout-plan-2026-04-06.md`
- API modules:
  - `apps/api/src/modules/admin/subscriptionPlans/*`
  - `apps/api/src/modules/profile/subscription/*`
  - `apps/api/src/modules/subscriptions/payments/*`
