# Working Agreements

- Tiny, single-purpose changes.
- Docs and implementation stay in sync.
- Findings-first review style.
- No done state without validation evidence.
- Keep ownership and security checks explicit for sensitive areas.
- Keep repository artifacts in English.
- Keep AI/user communication in the user's language.
- Delegate via subagents only with explicit ownership and non-overlapping scope.
- Before each commit, run tests for impacted areas and record the exact command(s).
- Treat every change as cross-module by default: check callers/consumers and update all affected paths in the same task.
- Never remove potentially shared code without verifying no remaining runtime/test/doc references.
- Keep commits tiny and reversible: one logical concern per commit, no mixed refactor+feature payloads.
