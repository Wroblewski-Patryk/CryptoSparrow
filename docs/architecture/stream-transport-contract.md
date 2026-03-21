# Stream Transport Contract (MVP Freeze-Gap)

## Decision
- Transport selected for MVP: `SSE` (Server-Sent Events).
- Date: 2026-03-19.
- Rationale:
  - One-way market updates (server -> client) fit SSE naturally.
  - Simpler auth and reverse-proxy behavior than custom app WebSocket gateway.
  - Better operational visibility (plain HTTP semantics, retry-friendly).

## Scope
- Source ingest: Binance WebSocket in worker layer.
- Fan-out to dashboard clients: SSE from API layer.
- Upgrade path (post-MVP): optional WebSocket gateway for bidirectional needs.

## Endpoint
- `GET /dashboard/market-stream/events`

### Query
- `symbols`: CSV uppercase symbols, max 20, example `BTCUSDT,ETHUSDT`
- `interval`: candle interval, default `1m`

### Auth
- Same auth as dashboard API (JWT/cookie/session middleware).
- Unauthorized clients must receive `401`.

## SSE Event Types
- `event: ticker`
- `event: candle`
- `event: health`

### `ticker` payload
```json
{
  "type": "ticker",
  "symbol": "BTCUSDT",
  "eventTime": 1700000000000,
  "lastPrice": 43210.5,
  "priceChangePercent24h": 2.45
}
```

### `candle` payload
```json
{
  "type": "candle",
  "symbol": "BTCUSDT",
  "interval": "1m",
  "eventTime": 1700000000100,
  "openTime": 1700000000000,
  "closeTime": 1700000005999,
  "open": 43000.1,
  "high": 43100.1,
  "low": 42950,
  "close": 43050.5,
  "volume": 100.25,
  "isFinal": true
}
```

### `health` payload
```json
{
  "type": "health",
  "connected": true,
  "lastEventAt": 1700000000123,
  "lagMs": 120,
  "worker": "market-stream"
}
```

## Reliability Rules
- Send heartbeat comment (`: ping`) every 10s.
- Send `health` at least every 15s.
- Client should auto-reconnect using browser SSE default behavior.
- Server should emit monotonically increasing `id` for events.

## Backward Compatibility
- Event shapes are additive-only in MVP freeze-gap.
- Any breaking event-field rename requires:
  - contract version bump (`X-Stream-Contract-Version`)
  - frontend parser compatibility layer
