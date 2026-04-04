# MVP Ops Runbook (Deployment and Recovery)

Scope: CryptoSparrow MVP on a single environment with:
- `apps/api` (API, port `3001`)
- `apps/web` (Next.js app, port `3002`)
- Postgres (`5432`) and Redis (`6379`) from `docker-compose.yml`

Use this runbook for repeatable deploys, quick rollback, and service recovery.

## 1. Pre-Deployment Checklist
- Pull latest code and confirm target commit hash.
- Verify env values exist and are correct:
  - `apps/api/.env`
  - `apps/web/.env.local`
- Ensure Docker is running (`docker compose ps`).
- Ensure DB connectivity from host:
  - `postgresql://postgres:password@localhost:5432/cryptosparrow?schema=public`
- Run baseline quality checks from repo root:
  - `pnpm --filter api test -- --run`
  - `pnpm --filter web test -- --run`
  - `pnpm --filter web build`

## 2. Deployment Procedure (MVP)
Run from repo root.

1. Start infra:
```bash
docker compose up -d
docker compose ps
```

2. Build backend:
```bash
pnpm --filter api build
```

3. Build frontend:
```bash
pnpm --filter web build
```

4. Start backend:
```bash
pnpm --filter api run run
```
Use `pnpm --filter api start` only for destructive local reset + seed workflow.

5. Start frontend (new terminal):
```bash
pnpm --filter web start
```

6. Smoke verify:
- Client: `http://localhost:3002`
- API: `http://localhost:3001`
- Login and open `/dashboard`.
- Confirm control-center safety bar, orders/positions widgets, and logs shortcut render.

## 3. Health Verification After Deploy
- API auth check:
```bash
curl http://localhost:3001/auth/me
```
Expected: authenticated response if cookie/token is present; otherwise controlled auth error (not 500).

- App navigation check:
  - `/dashboard`
  - `/dashboard/orders`
  - `/dashboard/positions`
  - `/dashboard/logs`
  - `/dashboard/exchanges`

- Infrastructure check:
```bash
docker compose ps
```
Both `postgres` and `redis` should be `Up`.

## 4. Rollback Procedure
Use rollback if deploy introduces regression in auth, trading views, or API availability.

1. Identify last known good commit:
```bash
git log --oneline -n 20
```

2. Checkout good commit in working tree:
```bash
git checkout <good_commit_sha>
```

3. Rebuild and restart app layers:
```bash
pnpm --filter api build
pnpm --filter web build
pnpm --filter api run run
pnpm --filter web start
```

4. Repeat Section 3 health checks.

5. Document rollback in release notes with:
- bad commit SHA,
- good commit SHA,
- user-visible impact,
- next fix owner.

## 5. Service Recovery Playbooks

### 5.1 API Not Responding (`3001`)
1. Confirm process is running.
2. Restart backend:
```bash
pnpm --filter api run run
```
3. Recheck `/auth/me`.

### 5.2 Client Not Responding (`3002`)
1. Restart frontend:
```bash
pnpm --filter web start
```
2. Hard refresh browser and retry `/dashboard`.

### 5.3 Database/Redis Outage
1. Restart infra:
```bash
docker compose down
docker compose up -d
docker compose ps
```
2. Restart backend and client.
3. Validate login and dashboard data loading.

### 5.4 PWA Cache/Service Worker Issues
1. In browser devtools, unregister service worker.
2. Clear site storage/cache.
3. Reload app and verify `/manifest.webmanifest` and `/offline` are reachable.

## 6. Data Safety Notes
- Do not change `DATABASE_URL` to a production DB from local scripts.
- Keep backups of Postgres volume before destructive DB maintenance:
  - `postgres_data` volume from docker compose.
- Do not commit secrets from `.env` or `.env.local`.

## 7. Incident Logging Template
Capture every deploy/recovery incident using:
- Timestamp
- Environment
- Symptom
- Root cause (if known)
- Actions taken
- Commit(s) involved
- Preventive follow-up task

## 8. Exchange API-Key Diagnostics
For API-key onboarding and Binance permission troubleshooting, use:
- `docs/operations/binance-api-key-onboarding-runbook.md`


