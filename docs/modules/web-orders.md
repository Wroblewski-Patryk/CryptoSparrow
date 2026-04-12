# Web Deep-Dive: Orders Module

## Metadata
- Module name: `orders`
- Layer: `web`
- Source path: `apps/web/src/features/orders`
- Owner: frontend/runtime-monitoring
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- `features/orders` is currently a placeholder module (directory structure only, no active feature files).
- Effective orders visibility has been consolidated into bots/dashboard runtime views.

Out of scope:
- Standalone `/dashboard/orders` page implementation.
- Order-write workflows from a dedicated orders module.

## 2. Boundaries and Dependencies
- Legacy route behavior:
  - `/dashboard/orders` is intercepted in web middleware and redirected to `/dashboard/bots/runtime?legacy=orders`.
- Operational dependencies:
  - order runtime views are currently served by bots and dashboard-home modules.

## 3. Data and Contract Surface
- No direct service/types/components contract exists yet under `features/orders`.
- Runtime order data contracts are consumed through bots runtime endpoints.

## 4. Runtime Flows
- Current user flow:
  1. User enters legacy orders path.
  2. Middleware redirects to bots runtime context.
  3. Orders are viewed inside bot monitoring/dashboard runtime tables.

## 5. UI Integration
- No dedicated route component exists for `/dashboard/orders`.
- Legacy compatibility is handled via middleware redirect only.

## 6. Security and Risk Guardrails
- Redirect keeps users in authenticated dashboard route space.
- Order data remains behind existing bot/runtime auth contracts.

## 7. Observability and Operations
- Middleware redirect preserves backward compatibility for old bookmarks.

## 8. Test Coverage and Evidence
- No module-local tests exist yet for `features/orders`.
- Validation focus is currently covered indirectly by bots/dashboard runtime test suites.

## 9. Open Issues and Follow-Ups
- Decide whether to keep orders consolidated in runtime views or reintroduce a dedicated orders feature module.
- If reintroduced, add explicit route/component/service contracts and module-local tests.

