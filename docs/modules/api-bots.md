# API Deep-Dive: Bots Module

## Metadata
- Module name: `bots`
- Layer: `api`
- Source path: `apps/api/src/modules/bots`
- Owner: backend/trading-domain
- Last updated: 2026-04-17
- Related planning task: `UXR-01`

## 1. Purpose and Scope
- Owns bot command + runtime read APIs:
  - bot lifecycle CRUD
  - runtime graph and session observability
  - market-group and strategy-link orchestration
  - assistant config + dry-run contract
- Bridges bot writes to wallet/strategy/market-group constraints and subscription/consent checks.

Out of scope:
- Core signal loop internals (engine module).
- Raw exchange execution transport (exchange module).

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/bots`.
- Depends on:
  - `prisma` bot/runtime persistence.
  - `engine` services (`runtimeSignalLoop`, execution orchestration, telemetry stores).
  - `wallets`, `subscriptions`, and consent/activation policy helpers.
  - symbol/risk/read-model enrichment helpers in module-local services/repositories.

## 3. Data and Contract Surface
- Command contracts:
  - `CreateBotDto`, `UpdateBotDto`, market-group/strategy link DTOs.
- Runtime read contracts:
  - sessions, symbol stats, positions, trades, runtime graph.
- Assistant contracts:
  - get/upsert config, subagent slot operations, dry-run decision trace.
- Key invariants:
  - wallet-market context compatibility.
  - LIVE consent + opt-in requirements.
  - activation capability checks and duplicate active-bot protections.

## 4. Runtime Flows
- Create/update bot:
  1. Validate ownership of strategy/market-group/wallet.
  2. Derive mode/exchange/marketType/apiKey from wallet context.
  3. Validate consent + activation policy.
  4. Persist bot + canonical market-group/strategy-link state.
- Runtime read:
  - aggregate session telemetry, symbol stats, position/trade enrichment, fallback market data.
- Assistant dry-run:
  - load bot assistant config/subagents and execute deterministic orchestration trace.

## 5. API and UI Integration
- Representative routes:
  - `GET/POST/PUT/DELETE /dashboard/bots`
  - `GET /dashboard/bots/:id/runtime-graph`
  - `GET /dashboard/bots/:id/runtime-sessions*`
  - `GET/POST/PUT/DELETE /dashboard/bots/:id/market-groups*`
  - `GET/PUT /dashboard/bots/:id/assistant-config`
  - `POST /dashboard/bots/:id/assistant-config/dry-run`

## 6. Security and Risk Guardrails
- Dashboard auth + ownership checks on all bot/runtime/assistant paths.
- LIVE activation requires explicit consent and capability validation.
- Mode-switch guard prevents unsafe PAPER->LIVE transitions with open managed positions.

## 7. Observability and Operations
- Runtime session/event/symbol stat telemetry integrated with engine services.
- Read models include stale/fallback handling for runtime market context.
- Extensive e2e coverage across create/update/runtime/entitlement scenarios.

## 8. Test Coverage and Evidence
- Primary tests:
  - `bots.e2e.test.ts`
  - `bots.orchestration.e2e.test.ts`
  - `bots.duplicate-guard.e2e.test.ts`
  - `bots.subscription-entitlements.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/bots/bots.e2e.test.ts src/modules/bots/bots.orchestration.e2e.test.ts src/modules/bots/bots.duplicate-guard.e2e.test.ts src/modules/bots/bots.subscription-entitlements.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Continue splitting oversized read/command surfaces where maintainability pressure is high.
- Complete error taxonomy migration for deterministic controller mapping.

## 10. Dashboard Ownership and Actionability Contract (`UXR-01`)
- Runtime positions read model (`listBotRuntimeSessionPositions`) is scoped to `managementMode=BOT_MANAGED` only.
- Dashboard `positions` rows for selected bot are allowed from:
  - direct ownership (`position.botId === selectedBotId`),
  - external takeover (`origin=EXCHANGE_SYNC`, `botId=null`) only if deterministic symbol ownership resolves to selected bot.
- Deterministic owner resolution for external symbol takeover is frozen as:
  - active bot first,
  - lower market-group `executionOrder`,
  - earlier bot `createdAt`,
  - lexical bot id tie-break.
- Close action (`closeBotRuntimeSessionPosition`) is fail-closed:
  - allowed only for `OPEN + BOT_MANAGED + wallet-compatible` rows owned directly or through external deterministic mapping,
  - all other paths return `status=ignored`, `reason=no_open_position`.
- External takeover audit statuses from positions module are non-actionable in dashboard close flow:
  - `UNOWNED`, `AMBIGUOUS`, `MANUAL_ONLY`.
- Dashboard `orders` contract for this module:
  - tab is always visible in LIVE and PAPER contexts,
  - rows are bot/wallet-scoped `BOT_MANAGED` open-order states (`PENDING`, `OPEN`, `PARTIALLY_FILLED`),
  - empty list is valid runtime state (tab must stay visible).
