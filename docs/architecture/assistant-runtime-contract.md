# Assistant Runtime Contract (MVP Foundation)

Status: canonical, locked for `MBA-14` on 2026-03-23.

## Scope
- Bot-scoped assistant topology: one main assistant + up to four subagents.
- Applies to `BACKTEST`, `PAPER`, `LIVE` decision orchestration layer.
- Assistant output is advisory unless execution policy allows action.

## Responsibilities
1. Main assistant:
   - build decision plan for current bot/market-group/symbol window
   - dispatch bounded tasks to enabled subagents
   - merge subagent outputs deterministically
   - return one final proposal: `LONG | SHORT | EXIT | NO_TRADE`
2. Subagent:
   - perform one role-limited analysis function
   - produce structured, machine-readable output
   - never bypass risk/mandate policies

## Roles (V1 Baseline)
- `TREND`
- `MOMENTUM`
- `RISK`
- `MICROSTRUCTURE`
- `GENERAL`

## I/O Schema
Input envelope:
- `requestId`
- `userId`, `botId`, `botMarketGroupId`
- `symbol`, `intervalWindow`
- `marketSnapshot`
- `strategyContext`
- `riskContext`
- `executionMode`

Output envelope:
- `requestId`
- `agentRole`
- `proposal` (`LONG | SHORT | EXIT | NO_TRADE`)
- `confidence` (0..1)
- `rationale` (short text)
- `signals` (structured key-value payload)
- `policyFlags` (optional warnings)
- `latencyMs`

## Timeout Policy
- main assistant hard timeout: `2500ms` (configurable)
- each subagent hard timeout: `1200ms` (configurable)
- per-slot timeout is isolated (one timeout does not kill the whole orchestration)

## Failure Semantics
- fail-closed mandatory rule:
  - if policy validation fails -> final output `NO_TRADE`
  - if merge determinism cannot be guaranteed -> `NO_TRADE`
  - if main assistant timeout -> fallback to strategy-only runtime path
- partial subagent failure:
  - continue with successful slots
  - mark failed slots in trace metadata
  - keep deterministic merge order

## Safety and Mandate Boundaries
- assistant cannot disable kill switch, bypass consent, or override risk caps.
- assistant cannot issue action outside bot mode/policy permissions.
- all assistant proposals are post-validated by runtime risk/execution guards.

## Audit and Explainability
For each assistant cycle persist trace:
- request envelope hash/id
- enabled slots and per-slot status (`ok | timeout | error | skipped`)
- raw proposals (sanitized)
- merge decision path
- final output and rejection reason (if `NO_TRADE`)

## Determinism Rules
- stable merge precedence:
  1. hard safety guards
  2. explicit `EXIT` from risk/main policy
  3. weighted directional merge
  4. tie/weak consensus => `NO_TRADE`
- deterministic tie-break keys:
  - role priority
  - confidence
  - slot index
  - lexical `agentRole` fallback

## Runtime Degradation
- assistant disabled or unavailable:
  - runtime continues in strategy-only mode
  - decision trace contains `assistantMode: degraded`

## Non-Goals for MVP Foundation
- autonomous model retraining in runtime hot path
- free-form unstructured assistant output contracts
- cross-user shared memory writes in synchronous execution path
