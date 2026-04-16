# Accessibility Full Pass Plan (2026-04-17)

Goal: close post-MVP full accessibility scope with explicit timeline, measurable gates, and evidence artifacts.

## Why This Plan Exists
- MVP and V1 already delivered baseline accessibility for core dashboard flows.
- Canonical open decision required one missing item: full-pass timeline and closure path.
- This plan defines tiny-commit execution tasks for that closure.

## Scope
- In scope:
  - Dashboard shell and high-traffic dashboard modules (`home`, `bots`, `markets`, `orders`, `positions`, `wallets`, `profile`).
  - Accessibility regression protection in tests and QA runbooks.
  - Canonical docs updates and evidence links.
- Out of scope:
  - Mobile-native app accessibility (separate track).
  - Major visual redesign work unrelated to accessibility compliance.

## Execution Timeline (Target)
- Week 1:
  - `A11Y-01` plan freeze + decision closure.
  - `A11Y-02` automated route-level accessibility baseline.
- Week 2:
  - `A11Y-03` priority remediation batch.
  - `A11Y-04` manual keyboard and screen-reader smoke pack.
- Week 3:
  - `A11Y-05` closure evidence, docs sync, and release gate update.

## Tiny-Commit Task List
- [x] `A11Y-01 docs(plan): publish full-pass timeline and resolve Accessibility Scope decision`
- [ ] `A11Y-02 test(web-a11y): add automated accessibility smoke for core dashboard routes`
- [ ] `A11Y-03 fix(web-a11y): remediate highest-priority issues from A11Y-02 findings`
- [ ] `A11Y-04 qa(a11y-manual): run keyboard + screen-reader smoke checklist and capture evidence`
- [ ] `A11Y-05 docs(closure): update canonical runbooks/plans and publish closure evidence artifact`

## Exit Criteria
- Automated accessibility smoke passes for selected core routes.
- Manual keyboard and screen-reader checklist completed with evidence.
- Known critical accessibility issues are closed or explicitly risk-accepted.
- Canonical planning/docs files are synchronized with closure status.
