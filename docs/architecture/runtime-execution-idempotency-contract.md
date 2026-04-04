# Runtime Execution Idempotency Contract

Status: canonical for runtime side effects (2026-04-04)

## Scope
- Applies to side-effecting runtime execution commands in `PAPER` and `LIVE`.
- Command set covered by this contract:
  - `OPEN` (entry open from final-candle decision),
  - `DCA` (position add),
  - `CLOSE` (position close),
  - `CANCEL` (order cancel).
- Does not replace strategy signal merge logic; it wraps execution so retries/restarts are replay-safe.

## Goal
- The same logical execution intent must produce at most one external side effect, even when:
  - stream events are re-delivered,
  - worker restarts mid-flight,
  - runtime watchdog restarts sessions.

## Canonical Dedupe-Key Schema (`v1`)

Every side-effect command must compute:
- `commandType`: `OPEN | DCA | CLOSE | CANCEL`
- `dedupeVersion`: fixed string `v1`
- `dedupeKey`: deterministic key built from normalized command identity fields

Format:
- `v1|{commandType}|{userId}|{botScope}|{symbolScope}|{windowScope}|{intentScope}`

Where:
- `botScope`: `{botId}` or `manual`
- `symbolScope`: uppercase symbol (for symbol-bound commands) or `na`
- `windowScope`: deterministic trigger window identifier (see command mapping below)
- `intentScope`: command-specific discriminator (direction/reason/level/orderId)

## Command Mapping

## `OPEN`
- Trigger source: final candle signal loop.
- Required identity:
  - `botId`,
  - `botMarketGroupId`,
  - `symbol` (uppercased),
  - normalized interval (for example `5m`, `1h`),
  - `candleOpenTime`,
  - `candleCloseTime`,
  - direction (`LONG`/`SHORT`).
- `windowScope`:
  - `{botMarketGroupId}|{interval}|{candleOpenTime}|{candleCloseTime}`
- `intentScope`:
  - `{direction}`

This preserves and formalizes existing in-memory `decisionWindowKey` semantics.

## `DCA`
- Trigger source: position automation after management evaluation.
- Required identity:
  - `positionId`,
  - `symbol`,
  - `dcaLevelIndex` (0-based level executed),
  - `positionSide` (`LONG`/`SHORT`).
- `windowScope`:
  - `{positionId}|level:{dcaLevelIndex}`
- `intentScope`:
  - `{positionSide}`

One DCA level can be executed once per position.

## `CLOSE`
- Trigger source: position automation close decision.
- Required identity:
  - `positionId`,
  - `symbol`,
  - `closeReason` (`TP|TTP|SL|TSL|EXIT|LIQUIDATION|FLOOR`).
- `windowScope`:
  - `{positionId}`
- `intentScope`:
  - `{closeReason}`

Closing an already closed position is replay-safe no-op.

## `CANCEL`
- Trigger source: runtime cancel path for open order lifecycle.
- Required identity:
  - `orderId`,
  - optional reason code (`stale_open|risk_stop|runtime_shutdown|manual_runtime_cancel`).
- `windowScope`:
  - `{orderId}`
- `intentScope`:
  - `{reasonCode}`

Canceling already final (`FILLED|CANCELED`) order is replay-safe no-op.

## Persistence Contract (for `PEX-02`)

Runtime dedupe persistence must store at least:
- `dedupeKey` (unique),
- `dedupeVersion`,
- `commandType`,
- `userId`,
- `botId` (nullable),
- `symbol` (nullable),
- `status`: `PENDING | SUCCEEDED | FAILED | EXPIRED`,
- `commandFingerprint` (JSON payload used to compute key),
- `firstSeenAt`, `lastSeenAt`,
- `ttlExpiresAt`,
- `orderId` (nullable),
- `positionId` (nullable),
- `errorClass` (nullable).

Uniqueness:
- DB unique index on `dedupeKey`.

## Execution State Machine

1. Compute canonical key and fingerprint.
2. Attempt atomic insert with `PENDING`.
3. If duplicate key exists:
   - `SUCCEEDED`: return previously persisted result (no side effect).
   - `PENDING`: treat as in-flight; do not execute duplicate side effect.
   - `FAILED`: allow retry only when failure class is marked retryable.
4. Execute side effect once.
5. Persist `SUCCEEDED` with resulting `orderId/positionId`.
6. On terminal failure persist `FAILED` + `errorClass`.
7. Expire/prune by TTL without deleting successful business entities.

## Retention and TTL

- `OPEN`: keep at least `RUNTIME_SIGNAL_DEDUPE_RETENTION_MS` window.
- `DCA/CLOSE/CANCEL`: keep minimum 24h by default (configurable).
- Prune job must be monotonic and never remove still-`PENDING` records younger than stale timeout.

## Observability Contract

Each command path should emit counters:
- `runtime_execution_dedupe_hit_total{commandType}`
- `runtime_execution_dedupe_miss_total{commandType}`
- `runtime_execution_dedupe_inflight_total{commandType}`
- `runtime_execution_dedupe_retry_total{commandType,errorClass}`

And structured event fields:
- `dedupeKey`,
- `commandType`,
- `status`,
- `replayOutcome` (`executed|reused|ignored_inflight|failed`).

## Safety Invariants

- No duplicate order open for same `OPEN` dedupe key.
- No duplicate DCA level application for same `(positionId, levelIndex)`.
- No double-close effect on the same position close intent.
- No repeated cancel side effect for the same order cancel intent.
- Idempotency logic must be mode-agnostic (`PAPER`/`LIVE`) and exchange-agnostic at contract layer.
