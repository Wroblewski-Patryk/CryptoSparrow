# CryptoSparrow

Monorepo with:
- `apps/server` (Express API)
- `apps/client` (Next.js app)

## Quick Start (Local)

### 1) Requirements
- Node.js 20+
- pnpm 10+
- Docker Desktop (Postgres + Redis)

### 2) Install dependencies
Run in project root:

```bash
pnpm install
```

### 2.1) Environment config
- Server: `apps/server/.env` (`SERVER_URL`, `SERVER_PORT`, `CLIENT_URL`, `CLIENT_PORT`).
- Client: `apps/client/.env.local` with `NEXT_PUBLIC_API_BASE_URL` (for example `http://localhost:3001`).
- Optional: set `CORS_ORIGINS` (comma-separated) in server env to allow multiple frontend origins.

### 3) Start infrastructure (terminal A)
Run in project root:

```bash
docker compose up -d
docker compose ps
```

Expected:
- Postgres on `localhost:5432`
- Redis on `localhost:6379`

### 4) Start backend (terminal B)
Run in project root:

```bash
pnpm --filter server dev
```

Backend URL:
- `http://localhost:3001`

### 5) Start frontend (terminal C)
Run in project root:

```bash
pnpm --filter client dev
```

Frontend URL:
- `http://localhost:3002`

## Browser vs Terminal
- In terminal you run services (`docker`, `server`, `client`).
- In browser you open `http://localhost:3002` to use the app.
- API is available at `http://localhost:3001`.

## Production-like local start
Server:

```bash
pnpm --filter server build
pnpm --filter server start
```

Client:

```bash
pnpm --filter client build
pnpm --filter client start
```

## Recent changes in this setup
- Added root workspace scripts in `package.json`: `lint`, `typecheck`, `test`, `build`.
- Added CI workflow: `.github/workflows/ci.yml`.
- Fixed server build runtime path by compiling server to CommonJS (`apps/server/tsconfig.json`).
- Added local runbook: `docs/local-development.md`.
- Added MVP ops runbook (deployment + recovery): `docs/mvp-ops-runbook.md`.
