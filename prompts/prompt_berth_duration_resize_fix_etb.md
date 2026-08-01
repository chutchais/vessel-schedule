Fix start-edge duration resizing so ETB cannot move before ETA.

Read AGENTS.md if present and inspect the shared schedule mutation/validation logic,
both planner views, schedule forms, resize preview and undo behavior.

Use this invariant:

ETA <= ETB < ETD

Requirements:

- If ETB exists, start-edge resizing changes ETB only.
- If ETB is null, start-edge resizing changes ETA.
- Never change ETA automatically when resizing ETB.
- ETB equal to ETA is valid.
- ETB before ETA is invalid.
- Start time equal to or after ETD is invalid.
- During invalid resizing, show a red preview with:
  “ETB cannot be earlier than ETA.”
- Do not save an invalid drop; restore the original shape.
- Enforce the same rule server-side for create, edit, move, resize and undo.
- Client validation is advisory; server validation is authoritative.
- Preserve conflict checks, organization isolation, concurrency protection and audit logs.
- Do not introduce a database migration in this task.

Add focused tests for ETB equal to ETA, ETB before ETA, ETB after ETA, ETB at/after ETD,
and null-ETB resizing ETA.

Run type-check, lint, relevant tests and production build. Append concise entries to
PROJECT_HANDOFF.md and CHANGELOG.md. Do not commit, push or deploy.