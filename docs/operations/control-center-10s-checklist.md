# Control Center 10-Second Operator Clarity Checklist

Use this checklist during manual QA for `/dashboard`.
Goal: within 10 seconds a user should understand mode, safety state, and next safe actions.

## Preconditions
- User is authenticated.
- Dashboard loads without blocking error screen.
- Browser viewport tested at least in:
  - mobile (`390x844`)
  - tablet (`768x1024`)
  - desktop (`1440x900`)

## 10-Second Checks
- [ ] `T+2s` Page title `Control Center` is visible and readable.
- [ ] `T+3s` Safety bar is visible without scrolling.
- [ ] `T+4s` Current mode badge (`PAPER`/`LIVE`) is visible in safety bar.
- [ ] `T+5s` Connectivity status is visible (`Online`/`Offline`).
- [ ] `T+6s` Heartbeat status is visible (`Checking`, `OK`, or `Delayed`).
- [ ] `T+7s` `Emergency Stop` action is visible and keyboard-focusable.
- [ ] `T+8s` Quick actions are visible (`Review Strategies`, `Open Orders`, `Run Backtest`).
- [ ] `T+9s` Risk notice is visible with links to logs/security.
- [ ] `T+10s` At least one path to investigate activity is visible (`Recent Activity` or `Open Audit Logs`).

## Keyboard/Focus Checks
- [ ] `Tab` reaches `Emergency Stop`.
- [ ] `Tab` reaches all quick action links.
- [ ] Focus ring is visible on interactive elements.
- [ ] `Skip to main content` link appears when focusing from top of page.

## Pass/Fail Rule
- `PASS`: all items checked on all 3 viewport groups.
- `FAIL`: any missing/hidden/unclear safety signal or blocked primary action.
