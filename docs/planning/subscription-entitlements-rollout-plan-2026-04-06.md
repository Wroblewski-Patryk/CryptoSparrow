# Subscription + Entitlements Rollout Plan (2026-04-06)

Status: active implementation plan for collaborator-ready account limits and future billing integration.

## Goal
- Introduce first-class subscription model with three tiers:
  - `FREE`
  - `ADVANCED`
  - `PROFESSIONAL`
- Show plan catalog in `My account -> Subscription` with explicit active-plan marker.
- Default all newly registered users to `FREE`.
- Ensure owner account (`wroblewskipatryk@gmail.com`) is seeded/mapped to `PROFESSIONAL`.
- Prepare payment integration architecture to support future gateway selection (Stripe/Klarna/other) without refactoring core subscription domain.
- Enforce plan-based runtime limits (for example bot count) from central entitlement policy.
- Make limits and prices editable from admin panel.

## Scope (V1 Extension)
- Data model, API contracts, UI surfaces, and admin configuration.
- Provider-agnostic checkout abstraction and payment-intent persistence contract.
- No forced gateway lock-in in this phase.

## Non-Goals (This Track)
- Final legal/tax invoicing scope by country.
- Full production checkout go-live.
- Multi-gateway orchestration in first iteration.

## Domain Contract (Target)
- Canonical contract: `docs/architecture/subscription-tier-entitlements-contract.md`.
- `SubscriptionPlan` catalog entity:
  - slug/code, display name, active flag, sort order.
  - monthly price + currency.
  - editable entitlement payload (limits/features).
- `UserSubscription` assignment entity:
  - active plan, status, period start/end, auto-renew.
  - assignment source (`DEFAULT`, `ADMIN_OVERRIDE`, `CHECKOUT`).
- `PaymentIntent` abstraction entity:
  - provider name, external reference, amount/currency/status.
  - metadata for idempotent reconciliation.

## Tiny-Commit Sequence
- [x] `SUBS-01 docs(contract): freeze tier catalog (FREE/ADVANCED/PROFESSIONAL), default assignment rules, and entitlement payload schema`
- [x] `SUBS-02 feat(db): add SubscriptionPlan + UserSubscription + PaymentIntent models with safe migration and indexes`
- [x] `SUBS-03 feat(seed): seed three plans; default new users to FREE; map owner account (wroblewskipatryk@gmail.com) to PROFESSIONAL`
- [x] `SUBS-04 feat(api-profile): expose subscription catalog + active subscription in profile endpoints (my-account ready)`
- [x] `SUBS-05 feat(web-profile): render subscription list with active-plan highlight in My Account -> Subscription`
- [x] `SUBS-06 feat(entitlements-core): add central entitlement resolver and enforce bot-count limits by active plan`
- [x] `SUBS-07 feat(api-admin): add admin CRUD for plan pricing + entitlement limits (editable without deploy)`
- [x] `SUBS-08 feat(web-admin): add admin UI modal for subscription price/limits editing`
- [x] `SUBS-09 feat(payment-abstraction): implement provider-agnostic payment gateway interface + checkout-intent API contract`
- [x] `SUBS-10 feat(payment-provider-stripe): add first provider adapter behind abstraction (toggleable, non-breaking)`
- [x] `SUBS-11 test(api+web): add regression suites for default FREE assignment, owner PROFESSIONAL mapping, plan highlighting, and entitlement enforcement`
- [ ] `SUBS-12 docs(runbook): publish operator/admin guide for plan edits, manual assignments, and payment-provider switch strategy`

## Done Criteria
- Registration assigns `FREE` deterministically.
- Owner account is deterministically assigned `PROFESSIONAL` in seed/bootstrap flow.
- Profile subscription view shows all plans and marks active plan.
- Entitlement rules block over-limit operations (for example bot creation) via centralized policy.
- Admin can edit limits and pricing without code deploy.
- Payment integration path is abstraction-first and provider-switchable.
