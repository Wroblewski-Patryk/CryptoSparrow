# V1 Post-Release Monitoring and Hotfix Protocol

## Monitoring Window
- Primary window: first 7 days after `v1.0` release.
- High-alert period: first 24 hours.

## Core Signals to Watch
- API:
  - error-rate trend,
  - p95 latency trend,
  - auth failure spikes.
- Trading:
  - order failure/retry spikes,
  - unexpected rejection patterns.
- Workers:
  - heartbeat gaps,
  - queue lag sustained above threshold.
- User impact:
  - support incidents,
  - repeated UI failure reports in critical flows.

## Duty Model
- On-call engineer and backup engineer assigned per day.
- Ops owner validates runtime alerts and runbook execution.
- Release owner tracks decision log for mitigations/hotfixes.

## Hotfix Decision Matrix
- P0 (safety/security outage):
  - immediate mitigation,
  - hotfix branch + fast-track review,
  - production deploy as soon as validated.
- P1 (major functional break in core flow):
  - hotfix within same day,
  - mandatory focused regression checks.
- P2/P3:
  - bundle for scheduled patch unless escalating impact appears.

## Hotfix Delivery Flow
1. Triage and classify incident severity.
2. Stabilize runtime (kill-switch/feature guard if needed).
3. Implement minimal reversible fix.
4. Run targeted tests for touched area.
5. Deploy hotfix and observe key metrics.
6. Write post-hotfix summary and follow-ups.

## Required Records
- Incident timeline with UTC timestamps.
- Hotfix commit hash and deployment timestamp.
- Verification checklist with passed checks.
- Follow-up task list for non-hotfix root improvements.
