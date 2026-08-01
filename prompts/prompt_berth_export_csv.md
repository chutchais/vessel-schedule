Implement secure CSV export for Vessel Schedules in the Berth Planner.

Read AGENTS.md if present. Inspect the current planner filters, organization-scoped planner
query, timezone utilities, conflict engine and existing PDF export. Read other documentation
only when relevant.

Scope:

- Add “Export CSV” to the Berth Planner.
- Export the selected terminal, visible week and active filters.
- Do not implement CSV import in this task.
- CSV configuration is independent of vessel labels and the configurable PDF table.

Default columns:

- scheduleReference
- vesselCode
- vesselName
- voyageNumber
- serviceCode
- serviceName
- terminalName
- berthName
- portTimezone
- eta
- etb
- etd
- berthPositionMeters
- berthPositionEndMeters
- headingReverse
- vesselLoa
- status
- hasConflict
- remarks
- updatedAt

Adapt field names to the actual schema and document the final contract.

Requirements:

- Generate CSV from authoritative domain data, never canvas pixels.
- Include all filtered schedules, not only shapes currently visible on-screen.
- Preserve deterministic sorting by effective start time, berth order and position.
- Use organization and terminal authorization derived server-side.
- Validate terminal, date range and filter parameters.
- Bound the export date range and record count.
- Use the port timezone consistently.
- Export timestamps in unambiguous ISO 8601 format with timezone offset.
- Calculate berthPositionEndMeters from position plus vessel LOA.
- Reuse the existing conflict engine for hasConflict.
- Missing values must be empty fields, never null or undefined.
- Produce UTF-8 CSV compatible with common spreadsheet software.
- Follow RFC 4180-style escaping for commas, quotes, CR/LF and multiline remarks.
- Prevent spreadsheet-formula injection: safely escape text beginning with =, +, -, @,
  tab or carriage return.
- Do not expose internal IDs, organization IDs, audit payloads, user data or secrets.
- Use a safe filename such as:
  vessel-schedules_<terminal>_<week-start>_<week-end>.csv
- Set correct Content-Type and Content-Disposition headers.
- Do not trigger a full-page reload.
- Show progress and clear failure states.
- Disable export while planner data is loading or an edit/drag/resize operation is active.
- Keep Position/Datetime view, week, filters, zoom and selection unchanged.
- Do not modify schedule data or create audit events unless existing policy explicitly
  requires auditing read-only exports.

Add tests for:

- Organization isolation and permissions
- Terminal/date/filter validation
- Active-filter consistency
- Stable column order and row sorting
- Port-timezone timestamps
- Missing values
- Quotes, commas and multiline remarks
- Formula-injection protection
- Position-end calculation
- Conflict flag
- Empty export
- Safe filename and response headers
- Maximum date range/record limit

Run type-check, lint, relevant tests and production build. Append concise entries to
PROJECT_HANDOFF.md and CHANGELOG.md. Do not commit, push, deploy, access production data
or change the deferred staging-test status.