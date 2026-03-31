# Dashboard + Bots Responsive Pass (2026-03-31)

Purpose: lock final responsive baseline for Dashboard -> Bots UX before final manual smoke (`BOPS-35`).

## Responsive Adjustments Applied
- Dashboard onboarding strip:
  - switched main grid to `lg`/`xl` breakpoints for cleaner tablet flow,
  - normalized action-card span from `md` to `lg/xl` to avoid cramped controls.
- Home control-center strip:
  - aligned card grid to `lg`/`xl`,
  - aligned quick-actions split to `lg` two-column layout,
  - aligned status-card row breakpoints with control-center behavior.
- Bots monitoring quick-switch:
  - grid now starts at `md` for better tablet card density,
  - bot names are truncated in cards to prevent overflow.

## Snapshot Lock Matrix
Capture and keep these reference screenshots after deploy to local QA build:
- `dashboard-control-center-mobile.png` (`390x844`)
- `dashboard-control-center-tablet.png` (`768x1024`)
- `dashboard-control-center-desktop.png` (`1440x900`)
- `bots-monitoring-mobile.png` (`390x844`)
- `bots-monitoring-tablet.png` (`768x1024`)
- `bots-monitoring-desktop.png` (`1440x900`)

## Acceptance Gate
- No horizontal overflow in top strips/cards on listed breakpoints.
- Primary CTA remains visible without additional scrolling on tablet/desktop.
- Monitoring quick-switch cards remain readable and selectable on tablet widths.
