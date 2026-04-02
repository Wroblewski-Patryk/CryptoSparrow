# Deployment Readiness Gates (Web/API/Workers)

Date: 2026-04-03  
Scope: Standardized gate contract for STAGE and PROD rollout decisions.

## Goal
Provide one deterministic gate pack for deployment promotion and post-deploy verification.

## Gate Categories

Automation entry point:
- Workflow: `.github/workflows/stage-gates.yml`
- Output artifact: `stage-gates-report-<run_id>` (`.json` + `.md`)
- Required stage secrets: `STAGE_DATABASE_URL`, `STAGE_API_BASE_URL`, `STAGE_WEB_BASE_URL`

### G1 - Build Gate
Required:
- `api` build succeeds.
- `web` build succeeds.
- no fatal dependency/install errors.

Failure effect: candidate blocked.

### G2 - Migration Gate
Required:
- migration status check succeeds,
- migration deploy step succeeds,
- no schema drift that invalidates rollout.

Failure effect: candidate blocked (no promotion).

### G3 - API Health/Readiness Gate
Required responses:
- `GET /health` -> HTTP `200`,
- `GET /ready` -> HTTP `200`.

Time budget:
- readiness must become green within configured rollout timeout.

Failure effect: stage fail (or prod rollback trigger if post-deploy).

### G4 - Web Availability Gate
Required:
- web root route returns HTTP `200`,
- web can reach API baseline endpoint through configured `NEXT_PUBLIC_API_BASE_URL`.

Failure effect: stage fail (or prod rollback trigger if post-deploy).

### G5 - Workers Readiness Gate
Required:
- worker service/processes are running,
- worker readiness signal is healthy (`/workers/health` and `/workers/ready` via API),
- no startup crash loop for execution/market workers.

Failure effect: stage fail (or prod rollback trigger if post-deploy).

### G6 - Smoke Gate
Required minimal smoke:
- login/session baseline works,
- dashboard baseline route loads,
- bot runtime read-model endpoint responds for active bot context.

Failure effect: candidate blocked from promotion.

## Stage Promotion Rule
Promotion to PROD is allowed only when **all required gates G1..G6 pass** for the same candidate SHA.

## Prod Post-Deploy Rule
After promotion, required post-deploy verification includes:
- G3 API,
- G4 Web,
- G5 Workers.

If any required post-deploy gate fails -> automatic rollback policy applies.

## Evidence Contract
Each gate run must produce machine-readable output:
- `gateId`,
- `status` (`PASS`/`FAIL`),
- `timestamp`,
- `candidateSha`,
- `environment`,
- `details` (error message or diagnostic payload).

Gate evidence is mandatory for release sign-off and incident audit trail.

## Fail-Closed Principle
Missing or inconclusive gate evidence is treated as `FAIL`.

No gate may be skipped for automatic promotion mode.
