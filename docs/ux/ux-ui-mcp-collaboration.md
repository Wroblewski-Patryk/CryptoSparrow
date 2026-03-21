# UX/UI MCP Collaboration Standard

## Goal
Define a repeatable workflow where implementation AI collaborates with UX/UI AI tools through MCP without losing project conventions.

## Design Source of Truth
- Primary: Figma MCP context (node/frame + screenshot + assets).
- Secondary: Stitch MCP can be used for ideation and draft exploration.
- Final implementation must be validated against a concrete approved artifact.

## Required Execution Flow
1. Identify target screen/flow and acceptance criteria.
2. Record design source (`figma_url` + node ID or approved snapshot path).
3. Pull MCP context and screenshot before implementation.
4. Implement using project conventions and shared components/tokens.
5. Validate parity: layout, spacing, typography, colors, interactions, states, responsive behavior.
6. Record evidence in task notes and review notes.

## Role Responsibilities

### Documentation Agent
- Define UX intent and constraints before execution.
- Add acceptance criteria for states, responsiveness, and accessibility.

### Planning Agent
- Do not mark UX tasks `READY` without design source reference.
- Require evidence fields in task acceptance criteria.

### Execution Agent
- Use MCP context before coding.
- Treat Stitch output as draft guidance unless explicitly approved as final artifact.
- Capture parity evidence in task notes.

### Review Agent
- Block completion when design source is missing.
- Block completion when parity/state/responsive/a11y evidence is missing.

## Minimal Prompt Contract
Use this shape when asking a UX-specialized agent/tool for implementation support:

```json
{
  "goal": "screen or flow to implement",
  "design_source": {
    "type": "figma|approved_snapshot",
    "reference": "url/node/path"
  },
  "platform": "web|mobile|both",
  "required_states": ["loading", "empty", "error", "success"],
  "constraints": [
    "reuse shared components",
    "use project tokens",
    "preserve existing contracts"
  ],
  "deliverables": [
    "implementation plan",
    "component mapping",
    "validation checklist"
  ]
}
```

## Required Evidence
- Design source reference
- Screenshot(s) for key states
- Responsive checks
- Accessibility checks
