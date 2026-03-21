# V1 Migration Notes

## Scope
This note covers migration expectations from MVP deployments to V1 runtime baseline.

## Data and Schema
- Apply all Prisma migrations before V1 cutover.
- Validate new performance indexes on orders/positions/backtests/logs.
- Confirm existing strategy payloads remain compatible with `strategy.v1` export/import flow.

## Configuration
- Review JWT rotation variables, especially previous-secret expiry window.
- Ensure API-key encryption key chain and active version are configured.
- Confirm worker queue environment variables in split-worker mode.
- Validate Redis connectivity for rate-limit/cache/queue observability paths.

## Runtime Rollout
1. Deploy API with read-only smoke verification.
2. Deploy workers and confirm `/workers/ready`.
3. Validate `/metrics` and `/alerts` baseline after rollout.
4. Enable live-critical actions only after risk guard checks pass.

## Backward Compatibility Notes
- Legacy API-key encrypted records remain readable through backward-compatible decrypt path.
- Existing dashboard modules remain route-compatible; no URL migration required.
- Existing bots default behavior remains unchanged unless LIVE mode is explicitly reconfigured.
