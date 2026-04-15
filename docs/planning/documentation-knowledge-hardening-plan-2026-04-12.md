# Documentation Knowledge Hardening Plan (2026-04-12)

Goal: make project context durable and execution-ready by ensuring each active code domain has canonical, discoverable, and maintainable documentation.

## Why Now
- Code-to-doc parity audit (2026-04-12) confirmed canonical module/route maps are now synchronized.
- Next gap is depth: most domains still lack dedicated module deep-dives in `docs/modules/*`.
- Without deep-dive coverage, execution agents and reviewers lose context and re-learn contracts repeatedly.

## North-Star Outcome
1. Any active module can be understood from docs without reading entire codebase.
2. Agent can execute tiny tasks from queue with deterministic context and acceptance criteria.
3. Docs drift is detected early via lightweight automated checks.

## Scope
### In Scope
- Module deep-dive docs for active backend and frontend domains.
- Canonical cross-reference map: routes -> UI feature -> API module -> runtime boundary.
- Documentation governance rules and done criteria.
- Tooling guardrails for basic docs parity checks.

### Out of Scope
- Rewriting stable historical artifacts under `docs/operations/_artifacts-*`.
- Large product strategy rewrite unrelated to runtime/domain contracts.
- One-shot monolithic docs rewrite in a single commit.

## Workstreams
1. Governance and templates.
2. Backend module deep-dives.
3. Frontend feature and route deep-dives.
4. Cross-domain execution trace docs.
5. Docs parity automation and evidence.

## Tiny-Commit Execution Queue (DCP)
1. `DCP-01 docs(governance): lock documentation parity policy and mandatory update triggers`
2. `DCP-02 docs(template): publish canonical module deep-dive template + authoring checklist`
3. `DCP-03 docs(index): create docs/modules index table mapping every active module to doc status`
4. `DCP-04 docs(api-identity): author deep-dives for admin/auth/profile/users modules`
5. `DCP-05 docs(api-trading-core): author deep-dives for engine/exchange/market-data/market-stream`
6. `DCP-06 docs(api-trading-domain): author deep-dives for strategies/markets/bots/orders/positions/backtests`
7. `DCP-07 docs(api-support): author deep-dives for reports/subscriptions/wallets/icons/upload/pagination/isolation`
8. `DCP-08 docs(web-core): author deep-dives for dashboard-home/auth/profile/admin flows`
9. `DCP-09 docs(web-trading): author deep-dives for bots/backtest/strategies/markets/exchanges/orders/positions/wallets/reports/logs`
10. `DCP-10 docs(route-contract): publish canonical route-to-feature-to-api mapping with ownership and guardrails`
11. `DCP-11 tooling(docs-parity): add script to verify module+route inventories against canonical docs`
12. `DCP-12 qa(docs-evidence): run parity check, publish evidence artifact, and close documentation hardening wave`

## Definition of Done (Wave)
1. Every active module/feature directory listed in module map has a deep-dive file or explicit justified exception.
2. Each deep-dive includes: boundaries, contracts, inputs/outputs, failure modes, tests, and operational links.
3. Route map and module map stay synchronized with code inventories.
4. `mvp-next-commits` queue includes DCP tasks and can drive execution without extra planning.
5. At least one automated parity check exists and is documented in engineering workflow.

## Validation Commands (Reference)
```powershell
Get-ChildItem -Path apps/api/src/modules -Directory | Select-Object -ExpandProperty Name
Get-ChildItem -Path apps/web/src/features -Directory | Select-Object -ExpandProperty Name
Get-ChildItem -Path apps/web/src/app -Recurse -Filter page.tsx
pnpm run docs:parity:check
```

## Canonical References
- `docs/modules/documentation-coverage-audit-2026-04-12.md`
- `docs/modules/system-modules.md`
- `docs/architecture/dashboard-route-map.md`
- `docs/planning/mvp-execution-plan.md`
- `docs/planning/mvp-next-commits.md`
