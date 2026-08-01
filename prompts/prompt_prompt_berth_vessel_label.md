Safe label styling

Do not accept or render raw HTML, CSS, style attributes, class names, JavaScript,
links or images. This application’s security assumptions require that users cannot
supply CSS or runtime style code.

Represent each configured label line as structured data containing:

- template
- fontWeight: REGULAR | BOLD
- fontSize: AUTO | SMALL | NORMAL
- textAlign: LEFT | CENTER | RIGHT
- textColor: AUTO | LIGHT | DARK

Requirements:

- Provide simple style controls beside each line in Organization Settings.
- Default the first line to BOLD and remaining lines to REGULAR.
- Default size to AUTO, alignment to CENTER and color to AUTO.
- AUTO color must select accessible contrast based on vessel background color.
- AUTO size must shrink within defined minimum/maximum limits.
- Do not allow arbitrary pixel sizes, font families, CSS colors or style strings.
- Render structured styles consistently in Position view, Datetime view, preview
  and PDF export.
- Preserve line priority when not every line fits.
- Clip every line inside the vessel shape.
- Tooltip/details must remain readable independent of visual label styling.
- Validate style enum values server-side.
- Store the structured configuration as validated JSON or normalized records,
  following existing project conventions.
- Add a schema version to the configuration so it can be migrated safely later.
- If an older plain multi-line template already exists, convert it to structured
  lines using default styles without losing its content.

Optional safe inline emphasis:

- If inline bold is genuinely needed, support only **text** markers.
- Parse them with a dedicated allowlisted parser.
- Do not use a general Markdown or HTML renderer.
- Reject malformed or nested markers.
- Ensure inline segments participate correctly in measuring, fitting, clipping,
  contrast and PDF export.
- Prefer whole-line styling for the MVP and treat inline emphasis as optional.