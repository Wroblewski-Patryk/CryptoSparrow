# Web Deep-Dive: Logs Module

## Metadata
- Module name: `logs`
- Layer: `web`
- Source path: `apps/web/src/features/logs`
- Owner: frontend/observability
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- Provides dashboard audit trail UI under `/dashboard/logs`.
- Supports filtering, table browsing, and metadata trace inspection for log events.

Out of scope:
- Log generation pipeline in runtime services.
- External log retention or export tooling.

## 2. Boundaries and Dependencies
- Route entrypoint:
  - `/dashboard/logs`
- Depends on:
  - logs API service (`GET /dashboard/logs`)
  - i18n/formatting helpers and shared loading state components

## 3. Data and Contract Surface
- Query surface:
  - source filter
  - severity filter
  - limit
- UI projection:
  - maps API entries into `AuditItem` rows with normalized trace payload rendering

## 4. Runtime Flows
- Load flow:
  1. Fetch logs with active filters.
  2. Normalize rows and keep selected trace row in sync.
  3. Render table plus trace panel.
- Trace flow:
  1. Select row.
  2. Serialize metadata to pretty JSON when possible.
  3. Display contextual badges and details.

## 5. UI Integration
- Main component:
  - `AuditTrailView`
- UI states:
  - loading skeleton
  - error with retry
  - empty
  - loaded table + trace details

## 6. Security and Risk Guardrails
- Logs are fetched only from authenticated dashboard API.
- Metadata rendering is text-based (`pre`) and not executed as HTML.

## 7. Observability and Operations
- Page supports manual refresh for incident workflows.
- Severity and source filters enable quick operator triage.

## 8. Test Coverage and Evidence
- Primary tests:
  - `AuditTrailView.test.tsx`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/logs/components/AuditTrailView.test.tsx
```

## 9. Open Issues and Follow-Ups
- Add pagination controls once backend log volume exceeds current client limit usage.
- Add saved filter presets for recurring operator investigations.

