Add object-level Audit History links to the Vessel Schedule application.

Users with Audit Log permission should be able to open the history for a specific:

* Company
* Port
* Terminal
* Berth
* Vessel
* Service
* Vessel Schedule

Reuse the existing organization Audit Log page and API. Do not create seven separate history implementations.

## Before changing code

Inspect:

* Existing AuditLog Prisma model
* Audit entity-type values currently stored
* Audit Log creation helpers
* `/api/audit-logs`
* `/api/audit-logs/[id]`
* `/audit-logs`
* Audit Log filters and pagination
* Audit details drawer
* Current-user and permission helpers
* Company, Port, Terminal, Berth, Vessel, Service, and Schedule managers
* Shared table and action components
* Local Next.js documentation in `node_modules/next/dist/docs/`

Run a read-only query or use Prisma Studio to confirm the exact `entityType` strings currently stored.

Do not assume values without checking.

Stop and report if:

* Audit Log is not implemented.
* Operational mutations are not creating audit records.
* Entity-type values are inconsistent.
* Organization scoping is missing.
* Audit API authorization is incomplete.

## Expected experience

Each record’s Actions area should include:

```text
Edit
History
Activate/Deactivate
```

Clicking History navigates to:

```text
/audit-logs?entityType=Vessel&entityId=<uuid>
```

Examples:

```text
/audit-logs?entityType=Company&entityId=<uuid>
/audit-logs?entityType=Port&entityId=<uuid>
/audit-logs?entityType=Terminal&entityId=<uuid>
/audit-logs?entityType=Berth&entityId=<uuid>
/audit-logs?entityType=Vessel&entityId=<uuid>
/audit-logs?entityType=Service&entityId=<uuid>
/audit-logs?entityType=VesselSchedule&entityId=<uuid>
```

The filtered page should show only audit entries for the selected object.

Do not implement a quick-history drawer in this phase. Start with the reusable filtered full page.

## 1. Centralize entity types

Create a shared constant in a suitable location such as:

```text
lib/audit/entity-types.ts
```

Use:

```ts
export const AUDIT_ENTITY_TYPES = {
  COMPANY: "Company",
  PORT: "Port",
  TERMINAL: "Terminal",
  BERTH: "Berth",
  VESSEL: "Vessel",
  SERVICE: "Service",
  VESSEL_SCHEDULE: "VesselSchedule",
} as const;

export type AuditEntityType =
  (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];
```

Adapt values only if existing stored Audit Logs use different canonical values.

Do not introduce new spellings if records already use:

```text
Company
Port
Terminal
Berth
Vessel
Service
VesselSchedule
```

Update audit-creation calls to use these constants where practical.

Avoid a broad unrelated refactor.

Do not rewrite historical AuditLog records unless inconsistent data is proven and a separate reviewed migration is necessary.

## 2. Audit API entity filters

Update:

```text
GET /api/audit-logs
```

to support:

```text
entityType
entityId
```

It may already support `entityType`; add or verify `entityId`.

Validate:

* `entityType` must be one of the supported organization entity types.
* `entityId` must be a valid identifier in the format used by the project.
* If `entityId` is provided, `entityType` is required.
* Reject unsupported entity types with `400`.
* Do not use raw unvalidated field names in Prisma queries.

When both are present, use:

```ts
where: {
  scope: "ORGANIZATION",
  organizationId: currentUser.activeOrganization.id,
  entityType,
  entityId,
}
```

Combine safely with existing filters:

* Search
* Action
* Actor
* Date from
* Date to
* Pagination

Never query object history using only:

```ts
where: {
  entityId,
}
```

Every query must include:

```text
scope = ORGANIZATION
organizationId = active organization
```

A guessed ID belonging to another organization must produce an empty result or `404` according to the existing API convention. It must never reveal that the object exists elsewhere.

Do not allow organization ID to come from query parameters.

## 3. Optional record-context response

When `entityType` and `entityId` are provided, include a safe context object in the list response:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  },
  "context": {
    "entityType": "Vessel",
    "entityId": "uuid",
    "entityName": "EVER GIVEN"
  }
}
```

Derive `entityName` from the newest matching authorized Audit Log.

Do not trust an entity name supplied in the URL.

If no matching Audit Log exists:

```json
{
  "entityName": null
}
```

Do not perform an unsafe cross-tenant entity lookup merely to obtain a heading.

If the existing API response should not be changed, derive the display name from the first returned authorized Audit Log instead. Use the smallest compatible change.

## 4. URL-driven Audit Log filters

Update `/audit-logs` to read:

```text
entityType
entityId
```

from the URL query string.

Follow the installed Next.js version’s current `searchParams` behavior.

If using `useSearchParams` in a Client Component, follow current Suspense requirements.

Do not use deprecated synchronous patterns if the installed version requires promised search parameters.

When object filters exist:

* Initialize Audit Log filters from the URL.
* Load page 1.
* Keep `entityType` and `entityId` applied when other filters change.
* Preserve them during pagination.
* Preserve them during action, actor, and date filtering.
* Do not lose filters during refresh.
* Browser Back and Forward should work.

Do not create an infinite effect/request loop.

## 5. Object-history page state

When `entityType` and `entityId` are active, show a contextual header.

Examples:

```text
Vessel History
EVER GIVEN
```

```text
Port History
Laem Chabang
```

```text
Vessel Schedule History
EVER GIVEN · IA5 · Voyage 001E
```

Fallback when no name is available:

```text
Vessel History
Record <short identifier>
```

Show a clear action:

```text
View All Audit Logs
```

Link:

```text
/audit-logs
```

In object-history mode:

* Display an indicator that results are limited to one object.
* Keep Action, Actor, and Date filters available.
* Hide or lock the general Entity Type filter.
* Do not show a confusing editable Entity ID field.
* `Clear filters` should clear Action, Actor, Search, and Date filters while preserving the object context.
* `View All Audit Logs` is the explicit way to remove object context.

When no object filters exist, preserve the existing general Audit Log behavior.

## 6. History links

Add a History action to the list/table for:

```text
Company
Port
Terminal
Berth
Vessel
Service
VesselSchedule
```

Use `URLSearchParams`:

```ts
const params = new URLSearchParams({
  entityType: AUDIT_ENTITY_TYPES.VESSEL,
  entityId: vessel.id,
});

const historyUrl = `/audit-logs?${params.toString()}`;
```

Use the correct constant for each module.

Do not include:

* organizationId
* entityName
* userId
* role
* audit scope

in the URL.

Use the entity ID only as a filter. The API remains the security boundary.

## 7. Action layout

Maintain a consistent Actions UI.

Preferred order:

```text
Edit
History
Activate/Deactivate
```

If the table is crowded, use the existing action-menu pattern rather than adding excessive table width.

Requirements:

* History must be a semantic link.
* It must support opening in a new tab.
* It must have a visible focus state.
* It must remain usable on mobile.
* It must not trigger row Edit behavior accidentally.
* It must use clear accessible text such as:

  * `View history for EVER GIVEN`

Do not add a History column if it creates unnecessary table width. Keep it within Actions.

## 8. Permissions

Follow existing organization Audit Log permission rules.

Expected initial rule:

| Role    |                            View object History |
| ------- | ---------------------------------------------: |
| OWNER   |                                            Yes |
| ADMIN   |                                            Yes |
| PLANNER | No, unless current policy explicitly allows it |
| VIEWER  |                                             No |

Only render History when the current user has permission.

However, hiding the link is not authorization.

The Audit Log API must continue enforcing:

* Authentication
* Active organization
* Active membership
* Required role
* Tenant scope

A user manually entering the filtered URL without permission must receive the same protected behavior as the normal Audit Log page.

Do not grant Audit Log access merely because the user can view the underlying object.

## 9. Entity names

Ensure newly created Audit Logs use useful `entityName` values.

Use:

| Entity         | `entityName`                            |
| -------------- | --------------------------------------- |
| Company        | Company name                            |
| Port           | Port name                               |
| Terminal       | Terminal name                           |
| Berth          | Berth name                              |
| Vessel         | Vessel name                             |
| Service        | Service code and name                   |
| VesselSchedule | Vessel, service code, and voyage number |

Examples:

```text
Ocean Network Express
Laem Chabang
Terminal A
Berth B03
EVER GIVEN
IA5 — Intra Asia Service 5
EVER GIVEN · IA5 · 001E
```

Preserve the entity name snapshot even if the object is renamed later.

History filtering must always use `entityId`, not `entityName`.

Do not modify old Audit Logs solely because a record was renamed.

## 10. Changed-field display

Reuse the existing Audit details drawer.

For each entry, display:

* Timestamp
* Actor
* Action
* Changed fields
* Before value
* After value

For CREATE:

```text
Created record
```

For ACTIVATE/DEACTIVATE:

```text
Status changed from Inactive to Active
```

For UPDATE:

Show only changed top-level fields in the comparison table.

Continue sanitizing displayed values.

Do not render unsafe HTML.

Do not expose redacted or secret source values.

## 11. Empty states

If the object has no Audit Logs:

```text
No history is available for this record yet.
```

Possible reasons may include records created before Audit Log was introduced.

Do not treat this as an application error.

Provide:

```text
View All Audit Logs
```

Do not create fake historical entries.

## 12. No Prisma relationship changes

Do not add relations such as:

```prisma
auditLogs AuditLog[]
```

to Company, Port, Terminal, Berth, Vessel, Service, or VesselSchedule.

AuditLog is polymorphic through:

```text
entityType
entityId
```

No schema migration should be required.

The existing index should support:

```prisma
@@index([entityType, entityId])
```

If it already exists, do not add a duplicate.

If it does not exist, report it before creating a migration. Do not create a migration unless genuinely needed and explicitly summarize why.

## 13. Security requirements

* Always scope logs to the active organization.
* Never trust organization ID from the URL.
* Never trust entity name from the URL.
* Validate entity type against an allowlist.
* Validate entity ID.
* Preserve existing role authorization.
* Do not expose platform Audit Logs through organization endpoints.
* Do not expose another organization’s object existence.
* Do not create public Audit Log routes.
* Do not weaken proxy or middleware protection.
* Do not expose before/after data to unauthorized roles.
* Do not expose Supabase secrets, tokens, cookies, or headers.

## 14. Manual verification

Test as OWNER or ADMIN:

1. Company History opens only that Company’s logs.
2. Port History opens only that Port’s logs.
3. Terminal History opens only that Terminal’s logs.
4. Berth History opens only that Berth’s logs.
5. Vessel History opens only that Vessel’s logs.
6. Service History opens only that Service’s logs.
7. Vessel Schedule History opens only that Schedule’s logs.
8. Object name appears in the contextual heading.
9. Action filter preserves object context.
10. Actor filter preserves object context.
11. Date filter preserves object context.
12. Pagination preserves object context.
13. Clear Filters preserves object context.
14. View All Audit Logs removes object context.
15. Browser Back restores the previous page and filters.
16. Empty history shows a useful empty state.
17. Audit details display correct before/after values.

Test permissions:

18. OWNER sees History.
19. ADMIN sees History.
20. PLANNER does not see History under the current policy.
21. VIEWER does not see History.
22. Manually entering a History URL does not bypass permissions.

Test isolation:

23. Organization A cannot view Organization B object history.
24. Guessing Organization B’s entity ID returns no data or `404`.
25. Switching active organization reloads and re-scopes history.
26. Platform Audit Logs do not appear in organization object history.

Test responsiveness:

27. Actions remain usable on mobile.
28. History page does not overflow.
29. Details drawer remains usable.
30. Links have visible keyboard focus.

## 15. Verification commands

Run:

```bash
npm run lint
npm run build
git diff --check
git status
```

If the Prisma schema was not changed, do not create a migration.

Fix errors introduced by this feature.

Do not modify unrelated files solely to remove pre-existing warnings.

## Final report

Report:

* Entity-type constants added
* API filters added
* Context response behavior
* Modules receiving History links
* Permission behavior
* Tenant-isolation behavior
* URL-filter behavior
* Empty-state behavior
* Manual test results
* Prisma migration status, if unchanged
* Lint result
* Build result
* Remaining pre-existing warnings
