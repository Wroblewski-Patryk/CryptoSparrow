# MBA-01 Domain Audit (2026-03-22)

Scope:
- User -> Bot -> SymbolGroup -> Strategy runtime contract
- current schema + runtime implementation
- non-breaking migration path toward: one bot, many market groups, many strategies per group

## 1. Current Contract (As-Is)

### 1.1 Data model
Source: `apps/api/prisma/schema.prisma`

- `User 1 -> N Bot`
- `User 1 -> N MarketUniverse`
- `MarketUniverse 1 -> N SymbolGroup`
- `BotStrategy` binds: `botId + strategyId + symbolGroupId`
- Constraint: `@@unique([botId, strategyId, symbolGroupId])`

Conclusion:
- Schema supports many-to-many cardinality between `Bot` and `SymbolGroup` through `BotStrategy`.
- Schema supports many strategies for a bot and for a symbol group (through multiple rows).

### 1.2 Runtime/API behavior
Sources:
- `apps/api/src/modules/bots/bots.service.ts`
- `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`

Current behavior:
- bot create/update currently exposes one `strategyId` UX path.
- service currently replaces bot mappings with a single effective binding (`deleteMany` then `create`).
- runtime signal loop fetches one enabled bot strategy (`take: 1`) and evaluates only that strategy context.

Conclusion:
- DB cardinality is broader than execution behavior.
- Effective runtime contract today is: one bot -> one active strategy binding at a time.

## 2. Gap to Target Model

Target model requested:
- one user can run many bots
- one bot can run many market groups
- one market group can run many strategies

Gaps:
1. API write model is single-binding-oriented (`strategyId` field), not graph-oriented.
2. Runtime fetch/evaluation path does not iterate over all bindings.
3. No deterministic merge policy for conflicting outputs from many strategies in one market-group.
4. Risk budgeting is bot-global, not explicitly group-partitioned.

## 3. Non-Breaking Migration Path

### Step A - Contract freeze and read graph
- keep current endpoints intact for compatibility
- add read-only graph endpoint: `bot -> marketGroups -> strategyBindings`
- introduce and document merge policy before runtime rollout

### Step B - Add explicit market-group runtime entity
- add `BotMarketGroup` table (bot-scoped operational grouping)
- keep existing `BotStrategy` rows valid
- backfill default `BotMarketGroup` per bot for existing rows

### Step C - Lift strategy links to group-level orchestration
- add `MarketGroupStrategyLink` (or evolve `BotStrategy`) with execution metadata:
  - `priority`
  - `weight`
  - `isEnabled`
- migrate old rows into new contract with deterministic defaults

### Step D - Runtime partition rollout
- evaluate per partition: `(bot, marketGroup)`
- compute strategy outputs in partition
- apply deterministic merge policy
- enforce no-flip and risk caps after merge stage

### Step E - Cleanup
- deprecate single `strategyId` update path in bot UI/API
- keep backward adapter for one release window
- remove adapter after parity e2e and load gates pass

## 4. Deterministic Merge Policy (Required Before Runtime Refactor)

Mandatory outputs per strategy per symbol tick/window:
- `LONG`, `SHORT`, `EXIT`, or `NO_TRADE`

Proposed deterministic order:
1. hard guardrails first (manual-managed symbol, no-flip, kill switch)
2. if any `EXIT` from enabled strategy with sufficient confidence -> `EXIT`
3. else resolve directional votes (`LONG` vs `SHORT`) by weighted score
4. if tie or weak consensus -> `NO_TRADE`

Rationale:
- preserves safety-first behavior and prevents random action under conflict.

## 5. Test Gate for Next Task

For `MBA-02` and onward, required baseline checks:
- API contract tests for graph read path
- runtime unit tests for multi-binding partition iteration
- e2e test: one user, two bots, multiple groups and multiple strategies

## 6. Decision

`MBA-01` outcome:
- target model is feasible without destructive migration.
- recommended path is additive, with compatibility layer first and runtime refactor second.
- no blocker found for moving into `MBA-02` and `MBA-03`.
