# Subscription Tier and Entitlements Contract

Status: accepted (2026-04-07)

## Purpose
- Freeze one canonical subscription catalog for V1 rollout (`FREE`, `ADVANCED`, `PROFESSIONAL`).
- Lock deterministic default assignment rules for new users and owner bootstrap mapping.
- Lock machine-readable entitlement payload schema used by API, UI, admin editing, and runtime guards.

## Canonical Tier Catalog
- Plan code enum (stable): `FREE | ADVANCED | PROFESSIONAL`.
- Legacy label `simple` is deprecated and treated as migration alias for `ADVANCED` only during transition.
- Canonical display order: `FREE` (1), `ADVANCED` (2), `PROFESSIONAL` (3).
- Catalog visibility rule: all plans are visible in My Account; active plan is highlighted.

## Default Assignment Rules
1. Every newly registered user is assigned `FREE` immediately after account creation.
2. Owner bootstrap mapping is required: `wroblewskipatryk@gmail.com` must be assigned `PROFESSIONAL`.
3. V1 invariant: one active subscription per user at a time.
4. Assignment source enum (stable): `DEFAULT | ADMIN_OVERRIDE | CHECKOUT`.
5. Bootstrap/seed flows must be idempotent (re-run safe, no duplicate active assignments).

## Entitlement Payload Schema (V1)
Every `SubscriptionPlan` stores one JSON payload in `entitlements` with this envelope:

```json
{
  "version": 1,
  "limits": {
    "maxBotsTotal": 1,
    "maxBotsByMode": {
      "PAPER": 1,
      "LIVE": 0
    },
    "maxConcurrentBacktests": 1
  },
  "features": {
    "liveTrading": false,
    "syncExternalPositions": true,
    "manageExternalPositions": false
  },
  "cadence": {
    "allowedIntervals": ["5m", "15m"],
    "defaultMarketScanInterval": "5m",
    "defaultPositionScanInterval": "5m"
  }
}
```

Schema rules:
- `version` is required and starts at `1`.
- `limits.maxBotsTotal` is required and enforces create-bot hard cap.
- `limits.maxBotsByMode` is required (`PAPER`, `LIVE`) and cannot exceed `maxBotsTotal`.
- `limits.maxConcurrentBacktests` is required and must be `>= 1`.
- `features.*` flags are required booleans.
- `cadence.allowedIntervals` values must come from global interval catalog.
- cadence defaults must be members of `cadence.allowedIntervals`.
- Future keys may be added under top-level `extensions` without breaking existing readers.

## V1 Seed Baseline (Editable in Admin)
- `FREE`:
  - `limits.maxBotsTotal = 1`
  - `limits.maxBotsByMode = { PAPER: 1, LIVE: 0 }`
  - `features.liveTrading = false`
- `ADVANCED`:
  - `limits.maxBotsTotal = 3`
  - `limits.maxBotsByMode = { PAPER: 3, LIVE: 3 }`
  - `features.liveTrading = true`
- `PROFESSIONAL`:
  - `limits.maxBotsTotal = 10`
  - `limits.maxBotsByMode = { PAPER: 10, LIVE: 10 }`
  - `features.liveTrading = true`

Notes:
- Seed values are defaults only; admin can edit limits/prices without deploy.
- Enforcement uses stored entitlement payload, not hardcoded tier constants in runtime paths.

## Profile/API Read Contract
Profile subscription response (for My Account) must expose:
- `catalog`: list of plans with `code`, `displayName`, `priceMonthly`, `currency`, `sortOrder`, `isActive`, `entitlements`.
- `activeSubscription`: current assignment with `planCode`, `status`, `startsAt`, `endsAt`, `autoRenew`, `source`.
- `activePlanCode`: denormalized helper for simple UI highlighting.

## Non-goals (This Contract)
- No gateway-specific checkout flow details.
- No invoice/tax localization specification.
- No multi-subscription stacking in V1.
