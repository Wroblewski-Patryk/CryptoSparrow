# Post-MVP Billing Rollout Milestones

## Goal
Define phased rollout for subscription billing expansion (monthly/annual variants + fiat/crypto rails) beyond MVP/V1 baseline.

## Milestone 1: Billing Model Foundation (P0)
- Introduce unified subscription plan model supporting:
  - monthly cycle (existing baseline),
  - annual cycle (new).
- Add explicit pricing versioning and effective-date support.
- Preserve one-active-subscription-per-user invariant.
- Acceptance:
  - migration safety tests for existing subscriptions,
  - backward-compatible API responses for current client flows.

## Milestone 2: Checkout Flow Upgrade (P0)
- Extend checkout to select billing period (`monthly` vs `annual`).
- Add annual-discount policy configuration.
- Keep abuse protections (failed-attempt cooldown and lockout policy).
- Acceptance:
  - contract tests for upgrade/downgrade billing-period transitions,
  - negative cases for failed payments and retry cooldown enforcement.

## Milestone 3: Fiat Payment Rail Integration (P1)
- Integrate first production fiat provider.
- Webhook verification + idempotent payment event handling.
- Invoice/receipt pipeline compatibility for new payment events.
- Acceptance:
  - webhook signature and replay-attack tests,
  - reconciliation checks against subscription state transitions.

## Milestone 4: Crypto Payment Rail Integration (P1)
- Add crypto checkout rail with confirmation-state handling.
- Define pending/confirmed/expired on-chain payment lifecycle.
- Map payment finality to subscription activation logic.
- Acceptance:
  - deterministic state machine tests for delayed confirmations,
  - operational runbook for chain/network incidents.

## Milestone 5: Entitlement and UX Harmonization (P1)
- Update user subscription UX for multi-cycle and multi-rail clarity.
- Keep one central subscription status source and lock-state messaging.
- Add audit logs for billing-critical mutations.
- Acceptance:
  - localization and accessibility checks for updated billing views,
  - regression tests for entitlement activation/deactivation timing.

## Milestone 6: Launch Hardening (P1)
- Billing smoke suite:
  - successful payment path,
  - failed payment path,
  - renewal,
  - cancellation and downgrade scheduling.
- Financial operations checklist:
  - reconciliation,
  - refund/dispute handling baseline,
  - incident escalation ownership.

## Sequencing Notes
- Deliver annual-cycle support before adding additional payment rails.
- Land fiat rail before crypto rail unless regulatory/provider constraints require inverted order.
- Keep launch behind explicit feature flags per billing rail.
