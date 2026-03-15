# Open Decisions

This file tracks intentionally unresolved architecture choices so implementation can proceed without losing context.

## Strategy Schema (MVP)
- Decision state: resolved on 2026-03-15.
- MVP schema is frozen as:

```json
{
  "version": "1.0",
  "name": "string",
  "enabled": true,
  "entry": {
    "logic": "AND",
    "rules": [
      {
        "indicator": "string",
        "timeframe": "string",
        "operator": "string",
        "value": 0
      }
    ]
  },
  "exit": {
    "logic": "OR",
    "rules": [
      {
        "indicator": "string",
        "timeframe": "string",
        "operator": "string",
        "value": 0
      }
    ]
  },
  "risk": {
    "positionSizing": {
      "mode": "fixed_amount",
      "value": 0
    },
    "leverage": 1,
    "stopLoss": {
      "type": "percent",
      "value": 0
    },
    "takeProfit": {
      "type": "percent",
      "value": 0
    },
    "trailingStop": {
      "enabled": false,
      "type": "percent",
      "value": 0
    },
    "dca": {
      "enabled": false,
      "maxAdds": 0,
      "stepPercent": 0
    },
    "maxOpenPositions": 1
  },
  "filters": {
    "symbols": {
      "mode": "all",
      "whitelist": [],
      "blacklist": []
    },
    "excludeStablePairs": true,
    "minVolume24h": 0
  },
  "timeframes": ["1m", "5m", "15m"]
}
```

- Notes:
  - Nested groups beyond top-level `logic` + flat `rules` are out of MVP scope.
  - Import/export versioning stays at `1.0` for MVP and can evolve after MVP.

## Rule Nesting Depth
- Open: how deep nested condition groups should be in MVP rule-based mode.
- Current assumption: basic nested groups supported later if not needed immediately.

## Preset Storage Format
- Decision state: resolved on 2026-03-15.
- MVP decision: keep presets code-defined (server-side templates in source control), not DB-stored.
- Scope for MVP:
  - Presets are read-only and versioned with application code.
  - No user CRUD for presets in MVP.
  - Preset selection is exposed via API as predefined options.
- Post-MVP migration trigger:
  - move presets to DB when user-defined sharing, version history, or per-tenant customization is required.

## Worker Split Timing
- Open: exact threshold for splitting API and workers into separate processes.
- Current assumption: split when queue lag or API latency exceeds acceptable limits.

## Accessibility Scope
- Open: full accessibility pass timeline.
- Current assumption: baseline accessibility in MVP, full pass after MVP.
