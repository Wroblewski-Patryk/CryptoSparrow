# Working Agreements

- Tiny, single-purpose changes.
- Docs and implementation stay in sync.
- Findings-first review style.
- No done state without validation evidence.
- Keep ownership and security checks explicit for sensitive areas.
- Keep repository artifacts in English.
- Keep AI/user communication in the user's language.
- Delegate via subagents only with explicit ownership and non-overlapping scope.
- Before each commit, run tests for impacted areas and record the exact command(s).
- Treat every change as cross-module by default: check callers/consumers and update all affected paths in the same task.
- Never remove potentially shared code without verifying no remaining runtime/test/doc references.
- Keep commits tiny and reversible: one logical concern per commit, no mixed refactor+feature payloads.

## Documentation Parity Policy (Mandatory)
- Treat documentation parity as release-blocking for structural changes.
- Any change in `apps/api/src/modules/*` directory inventory must include same-change update of `docs/modules/system-modules.md`.
- Any change in `apps/web/src/features/*` directory inventory must include same-change update of `docs/modules/system-modules.md`.
- Any change in route inventory under `apps/web/src/app/**/page.tsx` must include same-change update of `docs/architecture/dashboard-route-map.md`.
- Any moved/renamed canonical docs file must include same-change update of `docs/README.md`.
- Delivery queue updates must be reflected in both `docs/planning/mvp-next-commits.md` and `docs/planning/mvp-execution-plan.md` in the same task.
