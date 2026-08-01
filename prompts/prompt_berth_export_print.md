Add a configurable vessel-details table to Berth Planner Print and PDF Export.

First read AGENTS.md if present, PROJECT_HANDOFF.md, CHANGELOG.md,
MVP_RELEASE_CHECKLIST.md and prompt/ORGANIZATION_SETTINGS_VESSEL_LABEL_PLACEHOLDERS.md.
Inspect Organization Planner Settings, the shared placeholder registry, both planner
views and the existing print/PDF export renderer.

Before editing, report:

1. Current export page-generation flow
2. Existing placeholder resolver that can be reused
3. Proposed organization-level table configuration
4. Default columns
5. Any required Prisma migration

If a migration is required, explain it and wait for approval before creating it.

Goal:

Print and PDF export must contain:

1. Existing Berth Planner grid
2. A vessel-details table containing the schedules represented by the export

The table may continue onto additional pages.

Configuration:

Add a section:

Planner Settings → Export Vessel Table

Organization Owner/Admin can configure:

- Whether the details table is included
- Which predefined columns are visible
- Column order
- Custom user-facing column heading
- Column width mode: AUTO | COMPACT | NORMAL | WIDE
- Alignment: AUTO | LEFT | CENTER | RIGHT

Members can use the configured export but cannot change organization settings.

Reuse the existing predefined placeholder registry. Do not create a second independent
field resolver.

Default visible columns, in order:

1. Vessel — {{vesselName}}
2. Voyage — {{voyageNumber}}
3. Service — {{serviceName}}
4. Berth — {{berthName}}
5. Position — calculated from {{berthPositionStart}} and {{berthPositionEnd}}
6. ETA — {{eta}}
7. ETB — {{etb}}
8. ETD — {{etd}}
9. Status — {{status}}
10. Remarks — {{remarks}}

Use a compact practical default if all ten columns cannot remain readable. Remarks may
default to WIDE.

Configuration UI:

- Show available columns from the predefined placeholder catalog.
- Allow columns to be enabled/disabled.
- Allow drag-and-drop reordering with accessible Move Up/Move Down alternatives.
- Allow editing the display heading.
- Allow width and alignment selection.
- Show a live sample table preview.
- Add “Restore default”.
- Validate before saving.
- Save without a full-page reload.
- Audit create/update/reset of organization export settings.
- Do not audit individual print/export actions unless existing policy requires it.
- Do not allow duplicate column IDs unless explicitly designed as distinct custom columns.

Persistence:

Store a versioned structured configuration, for example:

{
  "version": 1,
  "includeTable": true,
  "columns": [
    {
      "id": "vesselName",
      "placeholder": "{{vesselName}}",
      "heading": "Vessel",
      "visible": true,
      "order": 1,
      "width": "NORMAL",
      "align": "LEFT"
    }
  ]
}

Adapt to existing project conventions.

- Scope configuration to the active organization.
- Validate every field and enum server-side.
- Allow only predefined placeholders.
- Reject arbitrary model paths, HTML, CSS, JavaScript and expressions.
- Preserve a built-in default when no saved configuration exists.
- Add a configuration schema version for future migration.
- Do not trust organizationId supplied by the client.

Table data:

- Include only schedules currently included by the export:
  - Selected organization
  - Selected terminal
  - Visible week
  - Active filters
- Do not include schedules hidden by filters.
- Ensure schedules clipped at week boundaries remain represented.
- Sort rows consistently, preferably by effective start time, berth order and position.
- Use the port timezone for ETA, ETB and ETD.
- Reuse the same formatting/calculation rules as vessel labels.
- Missing values render as an em dash or consistent empty marker.
- Never render null or undefined.
- Use local berth-position values consistently with zeroOriginSide.
- Keep complete remarks where practical, but wrap or safely truncate excessively long text.
- Treat all values as plain text.

Position column:

- Implement Position as a supported calculated/composite column using:
  {{berthPositionStart}}–{{berthPositionEnd}} m
- Do not calculate from canvas pixels.
- If physical placement is incomplete, display the standard missing-value marker.

Print/PDF layout:

- Place the table after the planner grid pages unless the current pagination architecture
  supports a clearer layout.
- Start it on a new page when insufficient space remains.
- Repeat the table header on every continuation page.
- Include organization, port, terminal, visible week and timezone in the table header.
- Show row count and active-filter summary.
- Use landscape orientation consistently with the planner export.
- Preserve readable font sizes.
- Prevent columns and rows from being cut between pages.
- Wrap long values within sensible limits.
- Use alternating row shading or borders that remain understandable in grayscale.
- Repeat necessary legend/context on continuation pages.
- Do not include interactive controls, tooltips, highlights, handles or animations.
- Export must remain deterministic and must not use the user’s personal on-screen vessel
  label font scale.

Print behavior:

- Ensure browser Print and generated PDF contain the same vessel table configuration.
- Hide the table from the normal interactive planner page unless shown as a settings preview.
- Do not trigger a full-page reload.
- Disable export while planner data is loading or an interaction is active.

Empty states:

- If no schedules match the export filters, show “No vessel schedules match this export.”
- If includeTable is disabled, export only the existing grid.
- If all columns are disabled, reject the configuration or automatically restore one required
  identifying column such as Vessel.

Accessibility:

- Settings controls must have accessible labels and keyboard support.
- Reordering must not depend only on drag-and-drop.
- Table markup used for browser printing should use semantic table headers where applicable.
- Ensure sufficient contrast.

Testing:

- Built-in default configuration
- Owner/Admin permission
- Member rejection
- Organization isolation
- Enable/disable table
- Column visibility
- Column order
- Custom headings
- Width/alignment validation
- Unknown-placeholder rejection
- Duplicate/empty-column handling
- Restore default
- Active-filter consistency
- Port-timezone formatting
- Position calculation
- Missing values
- Long remarks
- Multi-page table pagination
- Repeated headers
- Position and Datetime exports
- Browser print and generated PDF consistency
- Personal label scale does not affect export
- Empty schedule result

Update ORGANIZATION_SETTINGS_VESSEL_LABEL_PLACEHOLDERS.md with an “Export Vessel Table”
reuse section, keeping the placeholder catalog as the canonical shared contract.

Run Prisma validation if applicable, type-check, lint, all tests and production build.
Update PROJECT_HANDOFF.md, CHANGELOG.md and MVP_RELEASE_CHECKLIST.md.

Report changed files, persistence design, default columns, sorting, pagination and
verification results. Do not commit, push, deploy, access production data or change the
deferred staging-test status.