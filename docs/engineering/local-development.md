# Local Development Runbook

## Prerequisites
- Node.js 20+
- pnpm 10+
- Docker Desktop (required for Postgres and Redis)

## 1) Install dependencies
Run in repo root:

```bash
pnpm install
```

## 2) Start infrastructure layer (database + cache)
Run in repo root:

```bash
docker compose up -d
docker compose ps
```

Expected:
- `postgres` on `localhost:5432`
- `redis` on `localhost:6379`

## 3) Start backend layer (server)
Open terminal #1 in repo root and run:

```bash
pnpm --filter api dev
```

Expected:
- backend listens on `http://localhost:3001`

## 4) Start frontend layer (client)
Open terminal #2 in repo root and run:

```bash
pnpm --filter web dev
```

Expected:
- frontend listens on `http://localhost:3002`

## 5) Verify
- open `http://localhost:3002` in browser
- API base should be reachable at `http://localhost:3001`

## Useful commands
- Stop infrastructure:

```bash
docker compose down
```

- Build server:

```bash
pnpm --filter api build
```

- Run root workspace checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Quality Gate (Typecheck)
- Local quick gates:
  - `pnpm --filter api run typecheck`
  - `pnpm --filter web run typecheck`
  - `pnpm run typecheck` (aggregate root gate)
- CI gate:
  - `.github/workflows/ci.yml` runs `typecheck` for both `api` and `web` before tests.

## Notes
- Current client lint/type issues can fail `build`/`lint`, but `client dev` still starts for local development.

