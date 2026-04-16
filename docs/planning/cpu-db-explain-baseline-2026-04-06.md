# CPU/DB EXPLAIN Baseline (2026-04-06)

Date captured: 2026-04-16  
Scope: Group 6 (`CPDB-16..18`) runtime position hot-path queries.

## Method

1. Captured baseline plans with new indexes temporarily dropped:
   - `Position_userId_botId_status_idx`
   - `Position_userId_symbol_status_idx`
2. Recreated both indexes and captured "after" plans.
3. Used `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on dev PostgreSQL (`localhost:5432`).
4. Stored raw evidence in:
   - `docs/planning/_artifacts-cpdb18-explain-2026-04-16.json`

## Queries

1. `q1_count_open_by_bot`
```sql
SELECT COUNT(*)
FROM "Position"
WHERE "userId" = :userId
  AND "botId" = :botId
  AND "status" = 'OPEN';
```

2. `q2_exists_open_by_symbol`
```sql
SELECT "id"
FROM "Position"
WHERE "userId" = :userId
  AND "symbol" = :symbol
  AND "status" = 'OPEN'
LIMIT 1;
```

3. `q3_count_open_by_bot_and_symbols`
```sql
SELECT COUNT(*)
FROM "Position"
WHERE "userId" = :userId
  AND "botId" = :botId
  AND "status" = 'OPEN'
  AND "symbol" IN (:symbolA, :symbolB, :symbolC);
```

## Plan Summary (Baseline vs After)

| Query | Baseline scan | After scan | Baseline exec (ms) | After exec (ms) |
|---|---|---|---:|---:|
| `q1_count_open_by_bot` | `Seq Scan` | `Seq Scan` | `0.036` | `0.024` |
| `q2_exists_open_by_symbol` | `Seq Scan` | `Seq Scan` | `0.013` | `0.015` |
| `q3_count_open_by_bot_and_symbols` | `Seq Scan` | `Seq Scan` | `0.021` | `0.026` |

## Observed Delta

- On current dev dataset, planner kept `Seq Scan` both before and after index creation.
- Execution times remained in sub-millisecond to low-millisecond range; no meaningful regression observed.
- Result is consistent with a very small local table cardinality and low buffer pressure (`Shared Hit Blocks` = `1`).

## Manual Verification Notes

- Manual SQL verification was completed on local dev DB with index drop/recreate cycle.
- Index presence after verification was restored with:
  - `CREATE INDEX IF NOT EXISTS "Position_userId_botId_status_idx" ON "Position"("userId", "botId", "status")`
  - `CREATE INDEX IF NOT EXISTS "Position_userId_symbol_status_idx" ON "Position"("userId", "symbol", "status")`
- For staging/production-size datasets, rerun the same explain script and compare whether planner switches to index-driven paths.
