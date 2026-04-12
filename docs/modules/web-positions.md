# Web Deep-Dive: Positions Module

## Metadata
- Module name: `positions`
- Layer: `web`
- Source path: `apps/web/src/features/positions`
- Owner: frontend/runtime-monitoring
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- `features/positions` is currently a placeholder module (directory exists without active files).
- Position monitoring is currently embedded in dashboard-home and bots monitoring surfaces.

Out of scope:
- Dedicated `/dashboard/positions` page implementation.
- Independent positions feature-state management.

## 2. Boundaries and Dependencies
- Legacy route behavior:
  - `/dashboard/positions` is intercepted by middleware and redirected to `/dashboard/bots/runtime?legacy=positions`.
- Runtime dependencies:
  - position data contracts are consumed via bots runtime APIs in other modules.

## 3. Data and Contract Surface
- No local service/types/components contracts are defined in `features/positions`.
- Runtime position contracts are provided by bots service APIs.

## 4. Runtime Flows
- Current flow:
  1. Legacy positions route access triggers middleware redirect.
  2. User lands in bots runtime context.
  3. Position tables and controls are rendered by bots/dashboard-home modules.

## 5. UI Integration
- No dedicated app route component for `/dashboard/positions`.
- Compatibility path is redirect-only.

## 6. Security and Risk Guardrails
- Redirect remains within protected dashboard namespace.
- Position operations stay under authenticated bots runtime endpoints.

## 7. Observability and Operations
- Legacy redirect keeps previous bookmarks functional while IA remains consolidated.

## 8. Test Coverage and Evidence
- No module-local tests exist yet for `features/positions`.
- Position behavior is covered indirectly via bots/dashboard-home component tests.

## 9. Open Issues and Follow-Ups
- Decide long-term IA: dedicated positions module vs continued consolidation in runtime views.
- If extracted later, create dedicated contracts and regression coverage.

