# API Deep-Dive: Subscriptions Module

## Metadata
- Module name: `subscriptions`
- Layer: `api`
- Source path: `apps/api/src/modules/subscriptions`
- Owner: backend/billing
- Last updated: 2026-04-12
- Related planning task: `DCP-07`

## 1. Purpose and Scope
- Owns subscription catalog seed, entitlement resolution, and checkout intent orchestration.
- Provides plan limits/features contract used by bot creation and profile subscription surfaces.

Out of scope:
- Profile UI rendering and client-side plan presentation (web profile module).
- Final payment webhooks lifecycle (not implemented in this module snapshot).

## 2. Boundaries and Dependencies
- Direct API exposure is via profile routes:
  - `/dashboard/profile/subscription`
  - `/dashboard/profile/subscription/checkout-intents`
- Internal services are consumed by:
  - bot create limit enforcement (`assertSubscriptionAllowsBotCreate`)
  - profile subscription read flow
- Depends on:
  - Prisma models (`subscriptionPlan`, `userSubscription`, `paymentIntent`)
  - payment adapter registry (`MANUAL`, `STRIPE`)

## 3. Data and Contract Surface
- Subscription catalog seed:
  - `FREE`, `ADVANCED`, `PROFESSIONAL`
  - each plan defines limits, feature flags, and cadence defaults
- Entitlement contract (`SubscriptionEntitlementsSchema`):
  - limits: bot caps and backtest caps
  - features: live trading and external position controls
  - cadence: allowed intervals and defaults
- Checkout intent contract:
  - sanitized success/cancel URLs against allowlisted origins
  - persisted `paymentIntent` with idempotency key and provider metadata

## 4. Runtime Flows
- Entitlement resolution flow:
  1. Ensure subscription catalog exists.
  2. Ensure user has default active subscription (`FREE`) if missing.
  3. Resolve active plan and parse entitlements with fallback safety.
- Bot-create guard flow:
  1. Resolve user entitlements.
  2. Count current total and mode-specific bot usage.
  3. Throw `SubscriptionBotLimitError` when limits are exceeded.
- Checkout intent flow:
  1. Validate payable plan and sanitize redirect URLs.
  2. Resolve configured payment provider adapter.
  3. Create provider intent and persist internal payment intent record.

## 5. API and UI Integration
- Representative routes:
  - `GET /dashboard/profile/subscription`
  - `POST /dashboard/profile/subscription/checkout-intents`
- Rate limit:
  - checkout intent creation limited to 5 requests per 60 seconds per user.

## 6. Security and Risk Guardrails
- Dashboard auth required on profile subscription routes.
- Redirect URLs are origin-validated to prevent open redirects.
- Entitlements include fail-safe fallback to FREE plan structure when parsing fails.
- Unknown or unsupported payment provider config fails closed.

## 7. Observability and Operations
- Catalog seeding is idempotent (`upsert`) for stable boot/runtime behavior.
- Payment provider abstraction allows operational switch between manual and Stripe adapters.

## 8. Test Coverage and Evidence
- Coverage is currently mostly indirect through profile and bot flows.
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/bots/bots.subscription-entitlements.e2e.test.ts src/modules/profile/basic/basic.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Add dedicated e2e for checkout intent provider and URL sanitization contract.
- Add webhook-driven subscription state transitions for production billing lifecycle.

