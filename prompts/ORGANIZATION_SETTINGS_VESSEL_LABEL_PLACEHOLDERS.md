# Organization Settings: Vessel Label Placeholders

## Purpose

This document defines the predefined placeholders available in **Organization Settings → Planner Settings → Vessel Labels**.

The placeholder catalog is a shared contract and may be reused by:

- Position-domain Berth Planner labels
- Datetime-domain Berth Planner labels
- Vessel-label configuration previews
- Schedule tooltips and details
- Weekly print and PDF exports
- Future reports or organization-level display settings

Placeholders use double curly braces, for example `{{vesselName}}`. Implementations should resolve only placeholders from this allowlist. They must not execute HTML, CSS, JavaScript, expressions, or arbitrary model fields.

## Vessel Label Lines

| Model | Placeholder | Source column or definition |
| --- | --- | --- |
| Vessel | `{{vesselName}}` | `Vessel.name` |
| Vessel | `{{vesselLoa}}` | `Vessel.lengthOverall` |
| Service | `{{serviceName}}` | `Service.name` |
| Service | `{{serviceColor}}` | `Service.color` |
| VesselSchedule | `{{voyageNumber}}` | `VesselSchedule.voyageNumber` |
| Berth | `{{berthName}}` | `Berth.name` |
| Berth | `{{berthLength}}` | `Berth.berthLength` |
| Berth | `{{berthZeroOriginSide}}` | `Berth.zeroOriginSide` |
| VesselSchedule | `{{status}}` | `VesselSchedule.status` |
| VesselSchedule | `{{eta}}` | `VesselSchedule.eta`, formatted as time |
| VesselSchedule | `{{etb}}` | `VesselSchedule.etb`, formatted as time |
| VesselSchedule | `{{etd}}` | `VesselSchedule.etd`, formatted as time |
| VesselSchedule | `{{berthPositionStart}}` | Calculated occupied start position in metres |
| VesselSchedule | `{{berthPositionEnd}}` | Calculated occupied end position in metres |
| VesselSchedule | `{{headingReverse}}` | `VesselSchedule.headingReverse` |
| VesselSchedule | `{{remarks}}` | `VesselSchedule.remarks` |
| VesselSchedule | `{{berthDuration}}` | Calculated duration between ETA and ETD |
| VesselSchedule | `{{updatedAt}}` | `VesselSchedule.updatedAt`, formatted as ISO 8601 |

## Formatting and Calculation Rules

### Date and time

- `{{eta}}`, `{{etb}}`, and `{{etd}}` must use the selected port's timezone, not the browser timezone.
- The UI should use one consistent compact time format suitable for vessel shapes.
- `{{updatedAt}}` uses ISO 8601 unless a future placeholder explicitly introduces a localized display format.
- Missing values resolve to an empty string, never `null` or `undefined`.

### Measurements

- `{{vesselLoa}}`, `{{berthLength}}`, `{{berthPositionStart}}`, and `{{berthPositionEnd}}` are expressed in metres.
- Unit suffixes should be supplied by the template when required, for example `{{vesselLoa}} m`.
- `Berth.zeroOriginSide` affects screen-coordinate conversion but does not change the stored local berth-position value.

### Occupied berth positions

- `{{berthPositionStart}}` is the lower boundary of the occupied local berth interval.
- `{{berthPositionEnd}}` is the upper boundary of the occupied local berth interval.
- The normal physical interval is calculated from `VesselSchedule.berthPositionMeters` and `Vessel.lengthOverall`.
- `headingReverse` changes the visual bow direction but does not change the lower and upper occupied interval boundaries.
- If the position or vessel LOA is unavailable, both calculated position placeholders resolve to an empty string.

### Duration

- `{{berthDuration}}` is calculated between ETA and ETD as defined for this organization setting.
- If either ETA or ETD is unavailable, the placeholder resolves to an empty string.
- The display should use a compact human-readable duration, such as `12h 30m`.

### Color and Boolean values

- `{{serviceColor}}` resolves to the stored service color value. It is plain data and must not be interpreted as arbitrary CSS.
- `{{headingReverse}}` should resolve through a consistent user-facing representation rather than exposing implementation-specific values where possible.

### Remarks and long values

- `{{remarks}}` is plain text only.
- HTML and scripts must be escaped or treated as literal text.
- Canvas and export renderers may truncate long resolved values to fit, while the full value remains available in schedule details.

## Multi-line Template Example

```text
{{vesselName}} - {{voyageNumber}}
{{serviceName}}
ETA {{eta}} | ETB {{etb}} | ETD {{etd}}
BP {{berthPositionStart}}-{{berthPositionEnd}} m
{{remarks}}
```

## Reuse Contract

All consumers should reuse the same validated placeholder registry and resolver. They should not maintain separate placeholder names or calculation rules.

The registry should provide, at minimum:

- Placeholder identifier
- User-facing label and description
- Source model and field
- Value type
- Formatter or calculation function
- Missing-value behavior
- Preview/sample value

Adding, renaming, or removing a placeholder is a compatibility change. Existing saved organization templates must continue to render or be migrated explicitly.

## Security Rules

- Resolve only predefined allowlisted placeholders.
- Reject unknown placeholders during configuration validation.
- Never expose record IDs, organization secrets, audit payloads, authentication data, invitation tokens, or arbitrary database columns.
- Do not support raw HTML, CSS, JavaScript, Markdown rendering, or executable expressions.
- Treat all literal template content and resolved values as plain text.

