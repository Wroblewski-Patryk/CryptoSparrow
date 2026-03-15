# Open Decisions

This file tracks intentionally unresolved architecture choices so implementation can proceed without losing context.

## Strategy Schema (MVP)
- Open: exact JSON layout for strategy sections (`entry`, `exit`, `risk`, `filters`, `timeframes`).
- Decision state: pending during builder implementation.

## Rule Nesting Depth
- Open: how deep nested condition groups should be in MVP rule-based mode.
- Current assumption: basic nested groups supported later if not needed immediately.

## Preset Storage Format
- Open: presets as DB-stored JSON templates vs code-defined templates.
- Current assumption: start code-defined, move to DB when sharing/versioning is needed.

## Worker Split Timing
- Open: exact threshold for splitting API and workers into separate processes.
- Current assumption: split when queue lag or API latency exceeds acceptable limits.

## Accessibility Scope
- Open: full accessibility pass timeline.
- Current assumption: baseline accessibility in MVP, full pass after MVP.
