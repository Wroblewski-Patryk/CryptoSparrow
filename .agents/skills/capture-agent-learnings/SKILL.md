---
name: capture-agent-learnings
description: Capture verified project-specific execution learnings in `.codex/context/LEARNING_JOURNAL.md` and apply them immediately. Use when a recurring failure, Windows/PowerShell compatibility issue, CI pitfall, or workflow mistake is discovered.
---

# Capture Agent Learnings

## Procedure

## Step 1
Confirm the learning is real before logging it.
- Use at least one evidence source: terminal output, reproducible behavior, or primary documentation.

## Step 2
Check `.codex/context/LEARNING_JOURNAL.md` for an existing related entry.
- If an entry already exists, improve it instead of duplicating.
- If no entry exists, add a new one using the journal template.

## Step 3
Record a concise, operational guardrail.
- Include `Context`, `Symptom`, `Root cause`, and `Guardrail`.
- Add one `Preferred pattern` and one `Avoid` pattern.
- Keep entries short and actionable.

## Step 4
Apply the guardrail immediately in the current task.
- Update commands, scripts, tests, or docs in the same task so the learning becomes active behavior.

## Validation
- verify each new entry is backed by evidence
- verify command patterns match this repository shell context
- verify journal content contains no secrets, tokens, or personal data

## Output
- updated `.codex/context/LEARNING_JOURNAL.md`
- short note in task summary naming the new guardrail and where it was applied
