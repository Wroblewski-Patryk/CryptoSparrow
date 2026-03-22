# Mobile Parity Contract (Bootstrap Phase)

## Current Phase
`apps/mobile` exists as bootstrap scaffold only.

## Explicit Non-Goals (Now)
- No production mobile runtime.
- No independent mobile trading logic.
- No separate mobile backend contracts.

## Parity Source of Truth
Mobile must mirror web behavior from shared backend API contracts:
- auth/session behavior,
- dashboard module data contracts,
- bot/runtime safety semantics,
- backtest/report read contracts.

## Phase Gates Before Mobile Buildout
1. Web dashboard IA and module routes stable.
2. API contracts for runtime-critical modules stable and versioned.
3. Auth/session resilience closed (invalid/deleted/temporary-db-down paths).
4. Live/paper/backtest parity work reaches accepted baseline in web+api.

## Bootstrap Scope in Repository
- `apps/mobile/package.json` present.
- minimal README and source folder placeholders.
- no required CI build/test step yet.

## Future Start Criteria
When gates are met, mobile implementation starts with:
1. auth + session shell,
2. read-only operational modules (positions/orders/logs),
3. bot controls and backtest results,
4. optional advanced creation/edit flows.

