# App-Shell Template Split Contract (Public / Dashboard / Admin)

Status: Canonical (ADM-01)  
Last updated: 2026-04-04  
Scope: `apps/web` route shells and layout ownership boundaries.

## Goal

Lock one stable contract for three independent app shells:

1. `public` shell (marketing + auth entry),
2. `dashboard` shell (authenticated operator workspace),
3. `admin` shell (owner/admin control surface).

The split must preserve UX consistency where needed, while keeping security and IA boundaries explicit.

## Canonical Shell Matrix

| Shell | Route space | Primary user | Auth guard | Primary nav model |
|---|---|---|---|---|
| `public` | `/`, `/auth/*`, public info pages | guest / unauthenticated | no (except auth redirect helpers) | lightweight top nav + public footer |
| `dashboard` | `/dashboard/*` | authenticated end user/operator | yes (`requireAuth`) | product module nav (markets, strategies, backtests, bots, exchanges, analytics) |
| `admin` | `/admin/*` | admin/owner only | yes (`requireAuth + admin role`) | admin module nav (users, subscriptions, languages, settings) |

## Shared vs Dedicated UI Contract

### Shared across all shells

- brand identity component (`logo + brand wordmark`) should come from one reusable source,
- locale/theme controls should stay reusable primitives (same behavior contract),
- design system tokens come from active DaisyUI theme (no shell-specific hardcoded palette).

### Dedicated per shell

- route-level layout wrappers are separate per shell (`public`, `dashboard`, `admin`),
- navigation IA is shell-specific and must not leak unrelated menu trees,
- security messaging and guard redirects are shell-specific.

## Routing and Guard Policy

1. `/admin/*` must never reuse dashboard guard-only assumptions; it requires explicit admin authorization.
2. Unauthorized admin access returns deterministic fallback (redirect or dedicated unauthorized view), not partial dashboard render.
3. Dashboard shell must not render admin navigation items.
4. Public shell must not render dashboard/admin runtime controls.

## UX Consistency Rules

1. Header and footer rhythm should remain visually coherent across shells (same baseline spacing scale and typography system).
2. Dropdown behavior patterns should stay consistent (focus/hover/keyboard handling), even when menu content differs by shell.
3. Theme/locale switching semantics stay global and deterministic regardless of active shell.

## Rollout Tasks (Post-Contract)

- `ADM-02 feat(web-admin-shell)`: implement dedicated `/admin` app shell layout.
- `ADM-03 feat(web-admin-nav)`: add minimal admin IA navigation.
- `ADM-04 feat(web-admin-guard)`: enforce strict admin-only guard and fallback.
- `ADM-05 test(web-admin-shell)`: add route/layout/guard regressions.
- `ADM-06 docs(ops)`: update operator/deploy docs with admin shell topology.

## Non-Goals

- Implementing full admin business workflows in this contract step.
- Extending runtime trading logic.
- Redefining billing/domain product rules.
