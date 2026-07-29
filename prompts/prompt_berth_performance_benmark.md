Create a repeatable Berth Planner performance benchmark and optimize only measured bottlenecks.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect the planner queries, canvas rendering, geometry calculations, conflict detection, filtering, polling, Recent Changes and PDF export.

Before editing, report:

1. Current planner data and rendering flow
2. Likely measurement points
3. Proposed test-data generator
4. Existing relevant database indexes
5. Files expected to change

Test-data generator:

- Add a development/test-only command such as:
  npm run seed:planner-performance -- --schedules=500
- Support 100, 500 and 1,000 schedules.
- Generate a clearly named performance-test organization.
- Include one port, one terminal, multiple ordered berths, vessels, services and users.
- Include normal schedules, conflicts, incomplete records and schedules crossing week boundaries.
- Make generated data deterministic where practical.
- Allow repeated runs without accumulating duplicate data.
- Provide a safe cleanup option that removes only generated performance-test data.
- Refuse to run in production.
- Do not delete or modify normal user data.

Measurement:

Add development-only timing measurements for:

- Planner API/database query
- Data transformation
- Geometry generation
- Conflict calculation
- Position-view canvas drawing
- Datetime-view canvas drawing
- Hit testing
- Search and filter updates
- View switching
- Polling with no changes
- Polling with changed schedules
- PDF export

Use browser Performance APIs where appropriate. Do not expose sensitive data or produce noisy production logs.

Database:

- Inspect the actual planner and change-polling queries.
- Use EXPLAIN ANALYZE only against the development performance dataset.
- Report sequential scans, expensive sorting and missing indexes.
- Add database indexes only when supported by the measured query plan.
- Review generated migration SQL before applying it.

Benchmark these sizes:

- 100 schedules
- 500 schedules
- 1,000 schedules

Record:

- API duration and response size
- Initial planner render time
- Conflict calculation time
- Position/Datetime view-switch time
- Filter response time
- Drag and resize responsiveness
- Polling cost
- Memory behavior
- PDF export duration

Establish a baseline before optimizing. Optimize only demonstrated bottlenecks.

Potential optimizations may include:

- Memoizing geometry and conflict results
- Avoiding unnecessary React renders
- Using requestAnimationFrame for pointer updates
- Keeping high-frequency pointer data outside React state
- Incremental polling
- Efficient hit-testing or spatial indexing
- Skipping off-screen rendering
- Limiting Recent Changes rendering
- Database indexes

Do not introduce Web Workers, virtualization or broad architectural refactoring unless measurements show they are necessary.

Preserve:

- Position and Datetime views
- Click-to-create and editing
- Drag-and-drop and duration resizing
- Conflict panel
- Filters and URL state
- Undo
- Synchronization and changed-vessel highlighting
- Recent Changes
- Print/PDF export
- Organization isolation and authorization
- Port-timezone behavior

Verification:

- Run type-check, lint and relevant tests.
- Run the production build.
- Verify both planner views and primary interactions.
- Report baseline and optimized results separately.
- Explain exactly how to reproduce each benchmark.
- Update PROJECT_HANDOFF.md and CHANGELOG.md with commands, results and remaining limits.
- Do not commit or push.