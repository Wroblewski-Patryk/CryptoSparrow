# Rename Audit: `CryptoSparrow` -> `Soar`

Date: 2026-04-03  
Task: `DPL-11 docs(rename-audit)`

## Goal
Inventory current `CryptoSparrow`/`cryptosparrow` tokens and classify safe execution waves for controlled rename rollout.

## Source Method
Repository-wide search (`git grep -n -I -E "CryptoSparrow|cryptosparrow|CRYPTOSPARROW"`).

## Findings by Domain

### A) Runtime-Critical Identifiers (highest caution)
Examples:
- package and workspace naming:
  - `package.json` (`name`)
  - `apps/mobile/package.json` (`@cryptosparrow/mobile`)
- auth/JWT identity constants:
  - `apps/api/src/modules/auth/auth.jwt.ts` (`issuer`, `audience`)
  - related auth tests in `apps/api/src/modules/auth/*.test.ts` and middleware tests
- storage/cache keys:
  - `apps/web/src/i18n/I18nProvider.tsx` (`cryptosparrow-locale`)
  - `apps/web/src/ui/layout/dashboard/IsometricModeToggle.tsx` (`cryptosparrow-isometric-mode`)
  - `apps/web/public/sw.js` cache name
- database/container defaults:
  - `docker-compose.yml` (`POSTGRES_DB=cryptosparrow`)
  - scripts using default DB/container names.

Risk: changing these without compatibility bridge may break auth/session/state/cache/local infra assumptions.

### B) Deployment and Infrastructure Naming (high caution)
Examples:
- domains in deployment docs:
  - `cryptosparrow.luckysparrow.ch`
  - `api.cryptosparrow.luckysparrow.ch`
- Coolify project naming references (`cryptosparrow`)
- backup/restore artifacts and scripts referencing db/container naming.

Risk: premature rename can break DNS/routing/ops playbooks and incident tooling.

### C) UI/Branding Copy (medium risk)
Examples:
- app title and metadata:
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/app/manifest.ts`
- header/footer/public copy:
  - dashboard and public layout components,
  - PWA labels/theme labels.

Risk: low technical risk, but should remain synchronized with legal/product positioning and domain strategy.

### D) Documentation and Process Text (low technical risk, broad surface)
Examples:
- README and product docs,
- operations/security/architecture docs,
- agent prompt references in `.agents/` and `.claude/`.

Risk: inconsistency/noise if updated too early or partially.

## Wave Classification

### Wave 0 - Freeze + Mapping (current)
- This audit document.
- No runtime behavior change.

### Wave 1 - Safe Brand Surface (UI + docs, no protocol/id changes)
- UI labels, titles, visible copy.
- public docs and handbook wording.
- keep backward-compatible localStorage keys and theme aliases.

### Wave 2 - Compatibility Bridges (runtime identifiers)
- dual-read for legacy keys (`cryptosparrow-*`) + write-new (`soar-*`) if needed.
- auth token issuer/audience migration strategy (accept old+new during transition window).
- service worker cache version strategy to avoid stale asset conflicts.

### Wave 3 - Infrastructure Renames
- domains/project naming updates in deployment stack.
- db/container/script defaults migration.
- update monitoring/backup references.

### Wave 4 - Cleanup
- remove legacy aliases and backward-compat code after observation window.

## Guardrails for Implementation
1. No breaking rename in one-shot commit across runtime/security/deployment identifiers.
2. Runtime identifiers (JWT, storage keys, cache keys) require explicit compatibility window.
3. Domain/infrastructure rename must be coordinated with DNS/TLS/Coolify rollout plan.
4. Each wave requires rollback path and smoke checklist.

## Next Step
`DPL-12`: define full controlled rename rollout plan (`CryptoSparrow -> Soar`) with risk gates and rollback checkpoints.
