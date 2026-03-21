# Stitch MCP Playbook

## Purpose
Use Stitch MCP as a structured ideation and drafting tool for UX/UI tasks.

## Allowed Use
- early concept exploration
- alternative layout proposals
- component composition ideas

## Not Allowed as Sole Source
Stitch output alone must not be used as final source of truth for implementation.

## Required Pairing
Every Stitch-assisted task must include one of:
- Figma source reference (preferred), or
- approved design snapshot with explicit sign-off.

## Execution Checklist
1. Document the UX goal and scope.
2. Generate Stitch draft(s).
3. Select candidate draft and map to project design language.
4. Validate against approved source artifact.
5. Capture evidence in task/review notes.

## Evidence Fields
- `design_source_type`: figma | approved_snapshot
- `design_source_reference`: url/node/path
- `stitch_used`: yes | no
- `stitch_artifact_reference`: project/screen IDs or exported snapshot path
- `parity_check_result`: pass | fail
