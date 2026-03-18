# User Guide (V1)

This guide explains how to start safely with CryptoSparrow V1.

## 1. Onboarding
1. Create account and verify login.
2. Connect exchange API key in `Dashboard -> Exchanges`.
3. Build or import a strategy in `Dashboard -> Builder`.
4. Run backtest before any live activity.
5. Start in `PAPER` mode first.

## 2. Safety-First Rules
- Never start directly in `LIVE` without paper validation.
- Use small size and strict `maxOpenPositions` at first.
- Keep `liveOptIn` explicit and review consent text every update.
- Monitor logs and alerts before and during live sessions.
- Use emergency stop/kill switch immediately if behavior is unexpected.

## 3. Recommended First Session
1. Create one strategy for a single symbol/timeframe.
2. Run backtest and inspect report metrics.
3. Enable bot in `PAPER` mode only.
4. Observe at least one full market cycle.
5. Move to `LIVE` only after stable paper behavior.

## 4. FAQ
### Why do I need Docker locally?
The default local stack uses Docker for Postgres and Redis required by backend services.

### Why is LIVE blocked?
Most common reasons:
- `liveOptIn` is not enabled,
- `consentTextVersion` is missing,
- global kill switch is active.

### Why do I see delayed updates?
Check worker health/readiness and queue lag metrics. High lag can delay signal/order processing.

### Can I import strategies from another environment?
Yes. Use strategy import/export package format `strategy.v1`.

## 5. Troubleshooting
- App does not open:
  - verify client dev server is running (`pnpm --filter client dev`).
- API errors in dashboard:
  - verify backend (`pnpm --filter server dev`) and `NEXT_PUBLIC_API_BASE_URL`.
- `EADDRINUSE` on startup:
  - another process already uses the port; stop it or change port.
- Exchange order issues:
  - check API key status, rate limits, and `/alerts` output.
- Local test failures with DB errors:
  - ensure Docker Desktop is running and `docker compose up -d` is active.

## 6. What To Prepare Before LIVE
- Backtest evidence for current market regime.
- Paper-trade validation for operational behavior.
- Defined daily loss and stop conditions.
- Operator on-call and rollback plan available.
