# VPS Docker Compose Fallback Guide (Without Coolify)

Date: 2026-04-03  
Owner: Ops + Release Engineering  
Scope: fallback deployment path for single VPS when Coolify is unavailable.

## Purpose

Provide a deterministic production-like deployment path using only Docker Compose:
- `api`
- `web`
- dedicated workers (`market-data`, `market-stream`, `backtest`, `execution`)
- optional local infra profile (`postgres`, `redis`)

Canonical compose file:
- `docker-compose.vps.yml`

## Prerequisites

On VPS:
- Docker Engine + Compose plugin installed
- ports exposed through firewall / reverse proxy:
  - `3001` (api)
  - `3002` (web)
- repository cloned on VPS

## Environment setup

Create an env file next to compose:

```bash
cp .env.vps.example .env.vps
```

Then set at minimum:
- `NODE_ENV=production`
- `JWT_SECRET=<strong-secret>`
- `API_KEY_ENCRYPTION_KEYS=<versioned-keys>`
- `API_KEY_ENCRYPTION_ACTIVE_VERSION=<active-version>`
- `NEXT_PUBLIC_API_BASE_URL=<public-api-url>`

If using external managed DB/Redis:
- `DATABASE_URL=<external-postgres>`
- `REDIS_URL=<external-redis>`

If using local infra profile:
- keep defaults or override with local values.

## Variant A: Full stack on one VPS (with local postgres/redis)

Start:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml --profile infra up -d --build
```

Stop:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml --profile infra down
```

## Variant B: App-only (external postgres/redis)

Start:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```

Stop:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml down
```

## Health checks

API:

```bash
curl -f http://localhost:3001/health
curl -f http://localhost:3001/ready
```

Web:

```bash
curl -I http://localhost:3002
```

Container status:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml ps
```

Logs:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml logs -f api web workers-execution
```

## Worker ownership contract

Workers are separate processes and must stay independent from API lifecycle.

Expected worker services:
- `workers-market-data`
- `workers-market-stream`
- `workers-backtest`
- `workers-execution`

Do not merge workers into API process in production.

## Rollback (compose fallback)

1. Checkout previous stable commit.
2. Rebuild and restart:

```bash
git checkout <stable-sha>
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```

3. Re-run health checks.

## Common failure points

1. Missing `JWT_SECRET` or encryption keys in env.
2. Wrong `NEXT_PUBLIC_API_BASE_URL` -> web can load but cannot call API.
3. Not running workers -> stale runtime and no live updates.
4. Misconfigured `DATABASE_URL` / `REDIS_URL`.
5. Running without `--profile infra` while still pointing DB/Redis to local service names.

## References

- `docs/operations/coolify-linux-vps-setup-guide.md`
- `docs/operations/dev-stage-prod-environment-matrix.md`
- `docs/operations/v1-ops-runbook.md`
