# Stale Cache Incident Playbook

Purpose: provide a deterministic response when users see outdated runtime/authenticated data after deployment.

## 1) Verify

1. Confirm symptom scope:
   - Which surface is stale (`/dashboard`, `/auth`, `/admin`, runtime widgets, bots monitoring).
   - Whether issue is global or limited to specific browser/client.
2. Validate API cache headers on sensitive namespaces:
   - `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
   - `Pragma: no-cache`
   - `Expires: 0`
   - `Surrogate-Control: no-store`
   - `Vary: Origin`
3. Validate service worker behavior:
   - `sw.js` version in browser matches latest release.
   - Runtime/API requests are bypassed from SW cache (`/api`, `/auth`, `/dashboard`, `/admin`, `_rsc`).
4. Validate reverse-proxy behavior:
   - Sensitive namespaces are excluded from caching.
   - Static cache scope is limited to immutable assets only.
5. Collect evidence:
   - Response headers from affected route.
   - Browser network screenshot showing stale response and headers.
   - Current app commit SHA / deployed image tag.

## 2) Mitigate

1. Force fresh service worker lifecycle:
   - Trigger SW update check (focus/tab-visibility or manual refresh).
   - Confirm waiting worker activation handoff (`SKIP_WAITING`) and client takeover.
2. Bust static cache where needed:
   - Redeploy web with new asset hash/build output.
   - Ensure old `cryptosparrow-pwa-*` caches are removed on activate.
3. If issue persists, temporarily disable SW registration in production for emergency window and redeploy.
4. Keep users informed:
   - Announce temporary mitigation and expected refresh action (hard refresh / reopen tab).

## 3) Rollback

Rollback if mitigation does not restore freshness within incident SLA.

1. Roll back web image to last known-good release.
2. Keep API on current release unless header regression was introduced there.
3. Re-run verification checklist from section 1 against rolled-back version.
4. Confirm stale symptom clears on:
   - clean browser profile
   - existing session profile with previous SW cache

## 4) Exit Criteria

Incident can be closed only when all are true:

1. Fresh runtime/authenticated payloads are visible on affected routes.
2. Header checks pass on `/auth`, `/dashboard`, `/admin`.
3. SW update + activation handoff works on at least one existing client and one clean client.
4. Evidence (headers + screenshots + commit/image tag + mitigation timeline) is attached to incident record.

## 5) Post-Incident Follow-up

1. Add/adjust regression tests for the missed path.
2. Record root cause and prevention item in planning backlog.
3. If rollback was used, schedule re-introduction with explicit gate checks.
