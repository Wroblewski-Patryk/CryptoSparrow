# V1 Local Rollback Checklist (New Runtime -> Legacy Bot)

Purpose: safely revert to legacy runtime when cutover validation fails or runtime safety is degraded.

## Rollback Triggers
- execution anomalies after cutover (unexpected repeated failures),
- stale data + missing recovery in acceptable window,
- position-state mismatch that cannot be reconciled safely,
- unresolved critical alerts (`SEV-1`) after immediate mitigation attempt.

## Immediate Safety Actions
1. Disable new LIVE actions in new runtime.
2. Activate emergency controls where required (kill-switch / stop path).
3. Confirm no new orders are being issued by new runtime.

## Rollback Execution
1. Stop new runtime execution worker(s).
2. Preserve new-runtime logs and metrics snapshot for incident review.
3. Re-enable legacy runtime in read-then-write order:
   - verify market feed and strategy load,
   - verify account connectivity,
   - resume execution only after checks pass.
4. Confirm single active execution owner (legacy only).

## Post-Rollback Verification
1. Validate legacy runtime heartbeat and order path.
2. Confirm `/health` and key legacy process checks are green.
3. Validate no duplicate order attempts from both runtimes.
4. Record rollback incident summary and owner.

## Required Evidence
- Trigger reason and UTC timestamp.
- Operator who executed rollback.
- New-runtime shutdown confirmation.
- Legacy-resume confirmation.
- First 30-minute stability observation result.

## Follow-Up
- Open root-cause issue with:
  - failing signal/metric snapshots,
  - logs around rollback timestamp,
  - remediation owner and ETA.
