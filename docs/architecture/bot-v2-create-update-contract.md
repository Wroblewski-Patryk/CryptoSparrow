# Bot V2 Create/Update Contract (BMOD-01)

Status: canonical contract for Bot V2 creator/API migration.

Last updated: 2026-03-30.

## Scope

This contract freezes input/output rules for bot create/update in the Bot V2 rollout.

Primary goals:
- remove legacy creator fields that are not user-editable in V2,
- make `Strategy + Market Group` the canonical creator model,
- keep bot runtime configuration aligned with shared backtest/runtime logic.

## Canonical create payload (`POST /dashboard/bots`)

```json
{
  "name": "string",
  "mode": "PAPER | LIVE",
  "paperStartBalance": 10000,
  "strategyId": "uuid",
  "marketGroupId": "uuid",
  "isActive": false,
  "liveOptIn": false,
  "consentTextVersion": "string|null"
}
```

### Create payload rules

- `mode` supports only `PAPER` and `LIVE`.
- `paperStartBalance`:
  - required when `mode=PAPER`,
  - hidden in creator and not required when `mode=LIVE`.
- `strategyId` is required (exactly one strategy selected in creator flow).
- `marketGroupId` is required (exactly one market group selected in creator flow).
- `marketType` is derived server-side from selected market-group universe.
- `positionMode` is out of creator/API V2 scope (removed from write contract).
- `maxOpenPositions` is out of creator/API V2 write contract:
  - runtime limit is derived from strategy risk config and group policy.
- `liveOptIn=true` requires non-empty `consentTextVersion`.

## Canonical update payload (`PUT /dashboard/bots/:id`)

```json
{
  "name": "string?",
  "mode": "PAPER | LIVE ?",
  "paperStartBalance": "number?",
  "strategyId": "uuid?",
  "marketGroupId": "uuid?",
  "isActive": "boolean?",
  "liveOptIn": "boolean?",
  "consentTextVersion": "string|null?"
}
```

### Update payload rules

- Partial update is allowed.
- If `mode` changes to `PAPER`, `paperStartBalance` must be valid.
- If `liveOptIn=true`, `consentTextVersion` must be present after merge with current state.
- `strategyId` and `marketGroupId` updates must pass ownership and compatibility checks.
- `positionMode`, `marketType`, and `maxOpenPositions` are not client-writable.

## Transaction and data invariants

Create flow must be atomic:
- create `Bot`,
- attach selected `BotMarketGroup`,
- attach selected strategy link (`MarketGroupStrategyLink`).

Required invariants:
- all attached entities must belong to the same user (`ownership isolation`),
- selected market group market type must be compatible with derived bot market type,
- creator flow establishes one canonical strategy + one canonical market-group binding,
- runtime/read APIs may expose derived fields (`marketType`, effective caps), but those are not creator write inputs.

## Migration invariants

- Existing legacy bots remain readable during migration window.
- V2 write path must not accept legacy creator fields:
  - `positionMode`,
  - `maxOpenPositions`,
  - client-provided `marketType`.
- Temporary read compatibility for legacy `LOCAL` mode is transition-only and tracked separately in `BMOD-06`.

## Related canonical decisions

- `docs/planning/open-decisions.md`:
  - `Bot Runtime Trigger Policy (Creator/Runtime Alignment)`,
  - `Bot Monitoring Surface (Performance Safety)`.
