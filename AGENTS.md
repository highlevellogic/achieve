Development workflow

Codex has standing approval to make ordinary source changes that are
necessary and directly scoped to the user's current task. A separate
approval is not required before implementing those changes.

Codex has standing approval to create, modify, rename, and delete files
when those actions are ordinary, directly task-scoped development work.
This includes source files, examples, documentation, tests, temporary
test runners, and fixtures.

Explicit approval is still required before:

- destructive or difficult-to-recover actions outside normal task-scoped
  file editing;
- actions with external side effects, including publishing, deploying,
  sending messages, or modifying external services or data;
- staging Git changes;
- committing Git changes; or
- pushing Git changes.

Codex may run normal development commands and tests required to analyze,
implement, and verify the current task without separate approval.

Changes must remain scoped to the current task. Do not perform unrelated
cleanup, refactoring, formatting, dependency changes, or other
modifications merely because they appear desirable.

Do not stage, commit, or push unless explicitly instructed.

Benchmarking context

Before designing or interpreting Achieve performance experiments, read
`docs/engineering/benchmarking.md`. It records the project's established
benchmark methodology, November 2026 reference measurements, LAN test setup,
and unresolved limitations so that earlier investigations are not repeated or
overstated.
