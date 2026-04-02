# Dashboard Runtime Trades Table Plan (2026-04-02)

## Scope
- Module: `dashboard` (history table in Home runtime widget).
- Goal: improve operability for long trade logs with deterministic browsing.
- Non-goal: change bot execution logic.

## Problem
- Current dashboard history shows a long flat list.
- No server-side paging.
- No explicit API sorting/filter contract beyond `symbol` + `limit`.
- Auto-refresh can make manual inspection harder on bigger sessions.

## Target UX
- Server-driven table controls:
  - pagination (`page`, `pageSize`),
  - sort by selected columns,
  - quick filters (`symbol`, `side`, `action`, `from`, `to`).
- Stable row ordering with deterministic tie-break.
- Auto-refresh should refresh values without resetting current table context.

## API Contract Additions
- Endpoint: `GET /dashboard/bots/:botId/runtime-sessions/:sessionId/trades`
- Query:
  - `page` (default `1`)
  - `pageSize` (default `50`, bounded)
  - `sortBy` (`executedAt|symbol|side|lifecycleAction|margin|fee|realizedPnl`)
  - `sortDir` (`asc|desc`)
  - `symbol` (optional)
  - `side` (`BUY|SELL`, optional)
  - `action` (`OPEN|DCA|CLOSE|UNKNOWN`, optional)
  - `from`/`to` (ISO datetime, optional)
- Response additions:
  - `meta: { page, pageSize, total, totalPages, hasNext, hasPrev }`

## Backend Implementation Notes
- Use `skip/take` for pagination.
- Use validated dynamic `orderBy` with strict allow-list.
- Keep deterministic tie-break: `executedAt`, `createdAt`, `id`.
- Preserve current lifecycle inference (`OPEN/DCA/CLOSE`) and margin derivation.

## Frontend Implementation Notes
- Update bots runtime trade types + service query DTO.
- In dashboard history:
  - add table toolbar (filters),
  - sortable headers,
  - pagination controls,
  - keep selected page/sort/filter on silent auto-refresh.
- Do not globally refactor existing `DataTable` in this change.

## QA / Tests
- API tests:
  - page boundaries,
  - sort correctness,
  - combined filters.
- Web tests:
  - filter/sort triggers correct query,
  - pagination updates rows and counters,
  - silent refresh preserves current table state.

## Risks
- Query cost with many rows: mitigate with indexed fields and bounded page size.
- Row jump issues during refresh: mitigate with stable tie-break and server-side meta.
