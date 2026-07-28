# Prompt 5 of 5 — Organization and Platform Audit Log

Implement a secure, append-only Audit Log for this Vessel Schedule project.

Prompts 1–4 have already implemented:

* Organization-based multi-tenancy
* Supabase authentication
* User profiles
* Organization memberships
* Active organization context
* Roles and permissions
* Tenant-scoped operational APIs
* Guest organization requests
* Super Admin approval
* Organization invitations
* Member management
* Ownership transfer

This prompt covers:

1. Audit Log database model
2. Audit snapshot sanitization
3. Transaction-aware audit helper
4. Operational CRUD auditing
5. Invitation and membership auditing
6. Organization-request approval/rejection auditing
7. Organization-scoped Audit Log API and page
8. Platform-scoped Audit Log API and page
9. Before/after comparison UI
10. Audit security and immutability

Do not implement:

* Login-attempt logging
* Request-header logging
* IP-address tracking
* Browser fingerprinting
* Audit record editing
* Audit record deletion
* Restore/rollback from audit history
* Automatic retention/deletion
* Berth Planner

## Before writing code

* Inspect the complete Prisma schema.
* Inspect all migrations.
* Inspect authentication and authorization helpers.
* Inspect active-organization resolution.
* Inspect every POST and PATCH operational API.
* Inspect organization-request approval/rejection.
* Inspect invitations, membership management, and ownership transfer.
* Inspect existing Prisma transactions.
* Inspect shared table, drawer, badge, filter, and pagination components.
* Inspect local Next.js documentation under `node_modules/next/dist/docs/`.
* Run `npx prisma migrate status`.
* Confirm Prompts 1–4 are complete.
* Confirm public organization-request submission works without authentication.
* Preserve all existing data and behavior.

Stop and report if:

* Migration history is unhealthy.
* Tenant isolation is incomplete.
* Authentication is incomplete.
* Invitation or ownership-transfer flows are incomplete.
* `/request-access` incorrectly requires authentication.
* Existing mutations cannot be identified safely.
* Completion requires a database reset.
* A secret is exposed to browser code.

## 1. Audit enums

Add:

```prisma
enum AuditScope {
  ORGANIZATION
  PLATFORM
}

enum AuditAction {
  CREATE
  UPDATE
  ACTIVATE
  DEACTIVATE

  INVITE
  RESEND_INVITATION
  REVOKE_INVITATION
  ACCEPT_INVITATION
  DECLINE_INVITATION

  CHANGE_ROLE
  ACTIVATE_MEMBER
  DEACTIVATE_MEMBER
  TRANSFER_OWNERSHIP

  APPROVE_REQUEST
  REJECT_REQUEST
}
```

Use these meanings:

* `ORGANIZATION`: activity belonging to one customer organization.
* `PLATFORM`: platform administration activity that may not belong to an approved organization.
* `CREATE`: entity created.
* `UPDATE`: entity fields changed.
* `ACTIVATE`/`DEACTIVATE`: master-data active status changed.
* Invitation actions: organization membership invitation lifecycle.
* Membership actions: role/status/ownership changes.
* Request actions: Super Admin organization-request decisions.

Do not add login/logout actions in this phase.

## 2. AuditLog model

Add:

```prisma
model AuditLog {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  scope AuditScope

  organizationId String?       @db.Uuid
  organization   Organization? @relation(
    fields: [organizationId],
    references: [id],
    onDelete: SetNull
  )

  actorUserId String? @db.Uuid
  actorUser   User?   @relation(
    "AuditLogActor",
    fields: [actorUserId],
    references: [id],
    onDelete: SetNull
  )

  actorEmail       String? @db.VarChar(255)
  actorDisplayName String? @db.VarChar(200)

  action     AuditAction
  entityType String      @db.VarChar(100)
  entityId   String      @db.VarChar(100)
  entityName String?     @db.VarChar(250)

  beforeData Json?
  afterData  Json?
  metadata   Json?

  createdAt DateTime @default(now())

  @@index([scope])
  @@index([organizationId])
  @@index([organizationId, createdAt])
  @@index([actorUserId])
  @@index([action])
  @@index([entityType])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

Add reverse relationships:

```prisma
// Organization
auditLogs AuditLog[]

// User
auditLogs AuditLog[] @relation("AuditLogActor")
```

Adapt formatting to valid Prisma syntax.

### Scope rules

For `ORGANIZATION`:

```text
organizationId is required by application validation
```

For `PLATFORM`:

```text
organizationId may be null
```

Examples:

* Vessel update: ORGANIZATION
* Member invitation: ORGANIZATION
* Ownership transfer: ORGANIZATION
* Request rejection before an Organization exists: PLATFORM with null organization
* Request approval after Organization creation: PLATFORM with the new organization ID

Create migration:

```bash
npx prisma migrate dev --name add_audit_log
```

Do not use `prisma db push`.

Do not reset the database.

Do not modify previously applied migrations.

## 3. Append-only rules

Audit records are immutable application records.

Do not create:

```text
POST   /api/audit-logs
PATCH  /api/audit-logs/[id]
PUT    /api/audit-logs/[id]
DELETE /api/audit-logs/[id]
```

Only trusted server-side mutation handlers may create audit entries.

The UI must not provide:

* Edit
* Delete
* Restore
* Rollback
* Change status

Do not update an AuditLog after creation.

If an audit write fails inside a transaction, the related database mutation should also fail and roll back.

For cross-system Supabase operations, record the final successful application state. Do not claim that a rolled-back database transaction can roll back an already-sent external email.

## 4. Audit JSON sanitization

Create a helper such as:

```text
lib/audit/sanitize-audit-data.ts
```

It must recursively convert data into valid Prisma JSON:

* Date → ISO string
* Prisma Decimal → string or number consistently
* Enum → string
* bigint → string
* undefined → remove field
* Array → recursively sanitize
* Object → recursively sanitize
* null → preserve

Use explicit TypeScript types.

Avoid `any`.

Remove sensitive keys recursively, case-insensitively.

At minimum, remove:

```text
password
passwordHash
accessToken
refreshToken
token
inviteToken
invitationToken
authorization
cookie
setCookie
session
secret
clientSecret
serviceRole
serviceRoleKey
apiKey
databaseUrl
directUrl
connectionString
supabaseSecretKey
```

Also remove keys containing obvious sensitive suffixes or normalized equivalents.

Replace removed values with:

```text
"[REDACTED]"
```

or omit them consistently.

Do not serialize:

* Request objects
* Response objects
* Headers
* Cookies
* Supabase sessions
* Complete Supabase Admin responses
* Environment variables
* Error stack traces

Limit snapshot size.

Create a reasonable maximum serialized size, for example 50 KB per before/after/metadata value.

If exceeded:

* Store a safe truncated summary, or
* Reject the audit payload before mutation

Do not allow an audit entry to become an unbounded storage mechanism.

## 5. Transaction-aware audit helper

Create:

```text
lib/audit/create-audit-log.ts
```

The helper must accept a Prisma transaction client.

Suggested input:

```ts
type CreateAuditLogInput = {
  scope: "ORGANIZATION" | "PLATFORM";

  organizationId?: string | null;

  actor: {
    id: string;
    email: string;
    displayName: string;
  };

  action: AuditAction;

  entityType: string;
  entityId: string;
  entityName?: string | null;

  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
};
```

Requirements:

* Use the transaction client supplied by the caller.
* Do not start another transaction inside the helper.
* Validate ORGANIZATION scope requires organizationId.
* Sanitize all JSON data.
* Snapshot actor email and display name.
* Never accept actor identity from request bodies.
* Actor must come from authenticated server context.
* Create one AuditLog record.
* Return the created record only if needed.
* Keep the helper simple.

Do not silently ignore audit-write failures.

## 6. Snapshot guidelines

Audit snapshots should contain the entity’s direct business fields.

Do not store huge nested relationship graphs.

Examples:

### Vessel

Include:

* ID
* organizationId
* IMO number
* Name
* Call sign
* Flag
* Vessel type
* Dimensions
* Active status

### VesselSchedule

Include:

* ID
* organizationId
* serviceId
* vesselId
* terminalId
* berthId
* voyage number
* ETA/ETB/ETD
* ATA/ATB/ATD
* Status
* Berth position
* Remarks

### Invitation

Include:

* ID
* organizationId
* Normalized email
* Proposed role
* Status
* Delivery status
* Expiration

Do not include:

* Auth tokens
* Invite tokens
* Provider responses
* Secret delivery details

### Membership

Include:

* organizationId
* userId
* Role
* Active status
* Joined date

### OrganizationRequest

Include:

* Request ID
* Organization name
* Requester name
* Requester email
* Status
* Linked organization ID
* Reviewer ID
* Review date

Do not include internal provider errors if they could contain sensitive data.

## 7. Audit operational CRUD

Add audit logging to successful POST and PATCH operations for:

```text
Company
Port
Terminal
Berth
Vessel
Service
VesselSchedule
```

Use:

```text
scope = ORGANIZATION
organizationId = current active organization
actor = authenticated current User
```

### Create

Use:

```text
action = CREATE
beforeData = null
afterData = created entity
```

### Normal update

Use:

```text
action = UPDATE
beforeData = entity before update
afterData = entity after update
```

### Active-status changes

If `isActive` changes:

```text
false → true = ACTIVATE
true → false = DEACTIVATE
```

If active status and other fields change together, use ACTIVATE or DEACTIVATE and include all before/after values.

### Transaction behavior

For each mutation:

1. Validate authentication.
2. Validate authorization.
3. Validate request input.
4. Validate tenant ownership and relationships.
5. Start Prisma transaction.
6. Re-read the current entity inside the transaction when updating.
7. Create/update the entity.
8. Create AuditLog using the same transaction client.
9. Return committed data.

Do not create an audit entry for:

* Failed validation
* Unauthorized request
* Tenant mismatch
* Database operation that rolls back
* Read-only GET request

Preserve existing HTTP status codes and response shapes.

## 8. Audit invitations

Instrument:

```text
Create invitation
Resend invitation
Revoke invitation
Accept invitation
Decline invitation
```

Actions:

```text
INVITE
RESEND_INVITATION
REVOKE_INVITATION
ACCEPT_INVITATION
DECLINE_INVITATION
```

Use:

```text
scope = ORGANIZATION
organizationId = invitation organization
```

Actors:

* Invite/resend/revoke: authenticated manager
* Accept/decline: authenticated invitee

Requirements:

* Record only successful final state.
* Do not store invitation tokens.
* Do not store Supabase provider responses.
* Do not record delivery secrets.
* Invitation creation audit should be in the same transaction as invitation creation.
* If email delivery occurs after database creation, metadata may store a safe delivery status update only when recording a separate successful resend/delivery action.
* Acceptance audit must be in the same transaction as membership creation and invitation acceptance.
* Revoke/decline audit must be in the same transaction as status change.

For new users accepting an invitation, the actor User may be created in that same transaction. Use the created User as actor.

## 9. Audit member management

Instrument:

* Role change
* Membership activation
* Membership deactivation
* Ownership transfer

Actions:

```text
CHANGE_ROLE
ACTIVATE_MEMBER
DEACTIVATE_MEMBER
TRANSFER_OWNERSHIP
```

Use ORGANIZATION scope.

### Role change

Before:

```json
{
  "userId": "...",
  "role": "VIEWER",
  "isActive": true
}
```

After:

```json
{
  "userId": "...",
  "role": "PLANNER",
  "isActive": true
}
```

### Ownership transfer

Create one `TRANSFER_OWNERSHIP` audit entry containing:

```json
{
  "previousOwnerUserId": "...",
  "newOwnerUserId": "...",
  "previousOwnerRoleAfter": "ADMIN",
  "newOwnerRoleAfter": "OWNER"
}
```

Include before and after membership snapshots for both users.

Create it in the same ownership-transfer transaction.

Entity:

```text
entityType = Organization
entityId = organization ID
entityName = organization name
```

Do not create misleading independent role-change logs unless the design intentionally records both. Prefer one clear ownership-transfer event.

## 10. Audit platform organization requests

Instrument:

* Request approval
* Request rejection

Use:

```text
scope = PLATFORM
actor = authenticated SUPER_ADMIN
```

### Approval

Action:

```text
APPROVE_REQUEST
```

Entity:

```text
entityType = OrganizationRequest
entityId = request ID
entityName = requested organization name
```

Set `organizationId` to the created Organization ID when available.

Record:

* Request status before
* Request status after
* Created organization summary
* First Owner User ID
* First Owner membership role
* Safe invitation delivery status

Do not record:

* Supabase invitation token
* Supabase secret key
* Full provider response
* Session data

Because approval uses external Supabase operations, create the AuditLog in the final Prisma transaction that completes:

* User profile
* OWNER membership
* Request APPROVED status

If approval fails, do not create a successful APPROVE_REQUEST log.

### Rejection

Action:

```text
REJECT_REQUEST
```

Use PLATFORM scope.

`organizationId` may be null.

Create the audit record in the same transaction as request rejection.

Internal review notes may be included only if authorized platform audit viewers are allowed to see them. Sanitize and limit their size.

## 11. Organization Audit Log API

Create:

```text
GET /api/audit-logs
GET /api/audit-logs/[id]
```

Require:

* Authentication
* Active organization
* Active OWNER or ADMIN membership

PLANNER and VIEWER cannot access organization Audit Logs in this version.

Every query must include:

```ts
scope: "ORGANIZATION",
organizationId: currentUser.activeOrganization.id,
```

A log ID belonging to another organization must return `404`.

### List filters

Support:

```text
page
pageSize
search
action
entityType
actorUserId
dateFrom
dateTo
```

Defaults:

```text
page = 1
pageSize = 25
```

Maximum:

```text
pageSize = 100
```

Search:

* Actor email
* Actor display name
* Entity type
* Entity ID
* Entity name

Sort newest first.

Select only fields needed by the list.

Return:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  }
}
```

### Details API

Return complete sanitized AuditLog details.

Include current actor User summary when available, but always preserve snapshot actor fields as fallback.

Do not expose another organization’s log.

## 12. Platform Audit Log API

Create:

```text
GET /api/admin/audit-logs
GET /api/admin/audit-logs/[id]
```

Require:

```text
platformRole = SUPER_ADMIN
```

Organization OWNER is not sufficient.

Support filters:

```text
page
pageSize
search
scope
organizationId
action
entityType
actorUserId
dateFrom
dateTo
```

Return both:

* PLATFORM logs
* ORGANIZATION logs when explicitly appropriate for platform supervision

Default behavior should prioritize PLATFORM logs. If showing all scopes by default, make that explicit in the UI.

Do not let normal organization users access these APIs.

Do not use the normal active organization to restrict the platform view, but require explicit Super Admin authorization.

## 13. Organization Audit Log UI

Create:

```text
app/audit-logs/page.tsx
components/audit-logs/audit-log-manager.tsx
components/audit-logs/audit-log-details.tsx
```

Add navigation:

```text
Administration
- Audit Logs
```

Show to active OWNER and ADMIN.

API authorization remains mandatory.

### Page header

```text
Audit Logs
Review activity within your organization
```

No Add button.

### Filters

Provide:

* Search
* Action
* Entity type
* Actor
* Date from
* Date to
* Clear filters
* Result count

Use server-side pagination.

Debounce search briefly.

Reset to page 1 when filters change.

### Table

Columns:

* Date and time
* Actor
* Action
* Entity type
* Entity name
* Summary
* View Details

Use consistent badges.

Suggested action colors:

* CREATE: green
* UPDATE: blue
* ACTIVATE: green
* DEACTIVATE: gray or amber
* INVITE: blue
* ACCEPT_INVITATION: green
* REVOKE/DECLINE: gray or red
* CHANGE_ROLE: purple
* TRANSFER_OWNERSHIP: purple
* APPROVE_REQUEST: green
* REJECT_REQUEST: red

Handle loading, empty, and error states.

## 14. Platform Audit Log UI

Create:

```text
app/admin/audit-logs/page.tsx
components/admin/platform-audit-log-manager.tsx
```

Add under:

```text
Platform Administration
- Audit Logs
```

Show only to `SUPER_ADMIN`.

Display:

* Scope
* Organization
* Actor
* Action
* Entity
* Date
* Details

Filters:

* Scope
* Organization
* Action
* Entity type
* Actor
* Date range
* Search

Use server-side pagination.

Platform details may show request-review information, but never secrets.

## 15. Audit details drawer

Use the shared read-only Drawer.

Display:

* Timestamp
* Scope
* Organization
* Actor display name
* Actor email
* Action
* Entity type
* Entity ID
* Entity name

For CREATE:

* Show created values.

For UPDATE and status/role changes:

Show a comparison table:

```text
Field | Before | After
```

Calculate changed top-level fields in the UI.

Formatting:

* Date strings → readable date/time
* Booleans → Yes/No
* null → em dash
* Numbers → readable numeric format
* Objects and arrays → safe structured display
* Long values → wrap
* Redacted values → clearly display `[REDACTED]`

A collapsible raw JSON view may be included as a secondary view.

Do not make raw JSON the only representation.

Do not use unsafe HTML rendering.

Do not include edit, delete, restore, or rollback buttons.

## 16. Human-readable summaries

Create a simple helper for list summaries.

Examples:

```text
Created vessel EVER GIVEN
Updated schedule IA5 / 001E
Deactivated berth B03
Invited jane@example.com as Planner
Changed John Doe from Viewer to Planner
Transferred ownership from Jane Doe to John Doe
Approved organization request for ABC Shipping
```

Do not store fabricated summaries if they can be derived safely.

If stored in metadata, sanitize them.

Keep summary generation explicit and understandable.

## 17. Security requirements

* Derive actor from verified authenticated server context.
* Never accept actor ID from request bodies.
* Never accept audit scope from ordinary mutation request bodies.
* Derive organization ID from active organization or trusted entity state.
* Organization logs must always be tenant-scoped.
* Platform logs require Super Admin.
* No public Audit Log endpoints.
* No audit mutation endpoints.
* No audit UI editing.
* No secret values in snapshots.
* No request headers or cookies in logs.
* No Auth tokens in logs.
* No Supabase Admin response objects in logs.
* No cross-organization log access.
* Return `404` for another organization’s audit ID.
* Do not silently ignore audit failures.
* Prevent unbounded JSON size.
* Escape and safely render all displayed data.
* Do not use Audit Log as application authorization state.

## 18. Performance

* Use server-side pagination.
* Index organization and created date.
* Select only list fields for list endpoints.
* Load before/after snapshots only for details when practical.
* Avoid N+1 queries.
* Do not load all actors or organizations without limits.
* Use distinct/filter queries carefully.
* Do not filter thousands of Audit Logs in the browser.

## 19. Manual verification

Verify:

### Operational auditing

1. Create Company → one CREATE log.
2. Edit Port → one UPDATE log.
3. Deactivate Terminal → one DEACTIVATE log.
4. Activate Berth → one ACTIVATE log.
5. Create Vessel → one CREATE log.
6. Update Service → one UPDATE log.
7. Update Vessel Schedule dates → correct before/after log.
8. Failed validation → no log.
9. Unauthorized mutation → no log.
10. Rolled-back database mutation → no log.

### Invitation and membership auditing

11. Invite member → INVITE log.
12. Resend invitation → RESEND_INVITATION log.
13. Revoke invitation → REVOKE_INVITATION log.
14. Accept invitation → ACCEPT_INVITATION log.
15. Change role → CHANGE_ROLE log.
16. Deactivate member → DEACTIVATE_MEMBER log.
17. Transfer ownership → one clear TRANSFER_OWNERSHIP log.
18. Invitation tokens never appear in snapshots.

### Platform auditing

19. Approve request → APPROVE_REQUEST platform log.
20. Reject request → REJECT_REQUEST platform log.
21. Organization Owner cannot access platform logs.
22. Super Admin can access platform logs.

### Isolation and security

23. Organization A cannot see Organization B logs.
24. Guessed Organization B log UUID returns `404`.
25. Planner and Viewer cannot access organization logs.
26. No audit record can be edited through an API.
27. No audit record can be deleted through an API.
28. Sensitive test fields are redacted.
29. Supabase secret never appears in browser code.
30. Large snapshots are rejected or safely truncated.

## 20. Verification commands

Run:

```bash
npx prisma format
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run lint
npm run build
git diff --check
git status
```

Fix errors introduced by this prompt.

Do not modify unrelated code solely to remove pre-existing warnings.

## Stop conditions

Stop and report instead of guessing if:

* Prompts 1–4 are incomplete.
* Public request submission remains incorrectly protected.
* Migration history is unhealthy.
* Actor identity cannot be verified.
* Tenant scope cannot be determined.
* An existing mutation cannot be made transaction-safe.
* External invitation behavior would be misrepresented as transactional.
* Snapshot sanitization cannot guarantee secret removal.
* Cross-organization logs are visible.
* Completion requires a database reset.
* Audit writes are being silently ignored.

## Final report

Report:

* Prisma model and migration
* Audit enums
* Sanitization helper
* Transaction-aware audit helper
* Operational routes instrumented
* Invitation routes instrumented
* Membership routes instrumented
* Platform routes instrumented
* Organization Audit Log API and UI
* Platform Audit Log API and UI
* Authorization rules
* Tenant-isolation behavior
* Snapshot-size handling
* Redaction behavior
* Manual test results
* Prisma validation result
* Migration status
* Lint result
* Build result
* Remaining pre-existing warnings
* Any manual setup still required

Clearly state:

```text
Prompt 5 complete
```

Then stop. Do not begin the Berth Planner.
