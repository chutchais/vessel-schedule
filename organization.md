# Organization & Multi-Tenant Specification

This document consolidates all five organization-related implementation prompts for the Vessel Schedule project.

| Prompt | Title | Status |
|--------|-------|--------|
| 1 | Organization and Multi-Tenant Database Foundation | ✅ Complete |
| 2 | Authentication, Organization Context, and Tenant-Safe APIs | ✅ Complete |
| 3 | Guest Organization Request and Super Admin Approval | ✅ Complete |
| 4 | Organization Invitations and Member Management | ✅ Complete |
| 5 | Audit Log and Berth Planner | 🔜 Pending |

---

# Prompt 1 of 5 — Organization and Multi-Tenant Database Foundation

Implement the database foundation for organization-based multi-tenancy in this Vessel Schedule project.

This prompt covers only:

1. Organization model
2. User profile model
3. Organization membership model
4. Organization ownership of operational data
5. Safe migration and backfill of existing data
6. Tenant-specific unique constraints

Do not implement these yet:

* Login or logout
* Supabase Auth clients
* Guest request page
* Organization approval UI
* Member invitation UI
* Role-protected pages
* Audit Log
* API tenant filtering
* Berth Planner

Those will be implemented in later prompts.

## Project context

The project uses:

* Next.js App Router
* TypeScript
* Prisma
* PostgreSQL/Supabase
* Tailwind CSS

Existing modules include:

* Company
* Port
* Terminal
* Berth
* Vessel
* Service
* VesselSchedule

Important distinction:

```text
Organization = customer account that owns application data
Company      = operational company such as a shipping line, agent,
               terminal operator, or port authority
```

Do not use the existing `Company` model as the tenant.

Before modifying code:

* Inspect `prisma/schema.prisma`.
* Inspect every existing Prisma migration.
* Run `npx prisma migrate status`.
* Check whether the previous Berth/VesselSchedule migration-order problem is resolved.
* Inspect current relationships and unique constraints.
* Inspect the Service-to-Company relationship.
* Preserve all existing fields and working relationships.
* Do not reset or drop the database.
* Do not delete migration folders.
* Do not modify an already-applied migration.
* Stop and report if migration history is broken or inconsistent.

Keep the implementation simple and beginner-friendly.

## 1. Add enums

Add:

```prisma
enum PlatformRole {
  USER
  SUPER_ADMIN
}

enum OrganizationRole {
  OWNER
  ADMIN
  PLANNER
  VIEWER
}
```

`PlatformRole` controls platform-wide capabilities.

`OrganizationRole` controls permissions inside one organization.

A normal organization Owner is not automatically a platform `SUPER_ADMIN`.

## 2. Add Organization

Add:

```prisma
model Organization {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  name     String  @db.VarChar(200)
  slug     String  @unique @db.VarChar(100)
  isActive Boolean @default(true)

  members OrganizationMember[]

  companies       Company[]
  ports           Port[]
  terminals       Terminal[]
  berths          Berth[]
  vessels         Vessel[]
  services        Service[]
  vesselSchedules VesselSchedule[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
  @@map("organizations")
}
```

Use the exact existing model name for Vessel Schedule if it differs.

## 3. Add application User profile

Add:

```prisma
model User {
  id String @id @db.Uuid
  // This ID will later match Supabase Auth auth.users.id.

  email       String @unique @db.VarChar(255)
  displayName String @db.VarChar(200)

  platformRole PlatformRole @default(USER)
  isActive    Boolean      @default(true)

  memberships OrganizationMember[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([platformRole])
  @@index([isActive])
  @@map("users")
}
```

Do not add password, token, session, or authentication-secret fields.

Do not attempt to create a foreign key into the Supabase `auth` schema through Prisma in this prompt.

## 4. Add OrganizationMember

Add:

```prisma
model OrganizationMember {
  organizationId String       @db.Uuid
  organization   Organization @relation(
    fields: [organizationId],
    references: [id],
    onDelete: Cascade
  )

  userId String @db.Uuid
  user   User   @relation(
    fields: [userId],
    references: [id],
    onDelete: Cascade
  )

  role     OrganizationRole
  isActive Boolean          @default(true)

  joinedAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@id([organizationId, userId])
  @@index([userId])
  @@index([organizationId, role])
  @@index([organizationId, isActive])
  @@map("organization_members")
}
```

The membership table is required even if users initially belong to only one organization. It supports future invitations and multiple organization memberships.

Do not create users or memberships in this prompt unless an existing authenticated user profile already exists and can be mapped safely.

## 5. Add organization ownership

Add the following relationship to every tenant-owned operational model:

```prisma
organizationId String       @db.Uuid
organization   Organization @relation(
  fields: [organizationId],
  references: [id],
  onDelete: Restrict
)
```

Add it to:

```text
Company
Port
Terminal
Berth
Vessel
Service
VesselSchedule
```

Add this index to each model:

```prisma
@@index([organizationId])
```

Preserve existing parent-child relationships:

```text
Port → Terminal → Berth
Service → Company
VesselSchedule → Service
VesselSchedule → Vessel
VesselSchedule → Terminal
VesselSchedule → Berth
```

Do not remove or replace these relationships.

## 6. Clarify Service company relationship

The current Service company relationship means the shipping line that operates the service. Rename the Prisma field for clarity:

```prisma
operatorCompanyId String  @db.Uuid
operatorCompany   Company @relation(
  fields: [operatorCompanyId],
  references: [id]
)
```

Also keep:

```prisma
organizationId String
organization   Organization
```

The meanings are:

```text
organizationId    = customer organization that owns this record
operatorCompanyId = shipping-line Company operating the service
```

Preserve existing Service-to-Company data.

If the current database column is named `companyId`, do not drop it and create an empty replacement.

Use one of these safe approaches:

* Map the clearer Prisma field to the current column using `@map("companyId")`, or
* Customize the migration SQL to rename the column using PostgreSQL `ALTER TABLE ... RENAME COLUMN`.

Do not allow Prisma to drop a populated `companyId` column.

Update the reverse Company relation to use a clear name such as:

```prisma
operatedServices Service[]
```

Adapt explicit relation names if Prisma requires them.

## 7. Tenant-specific unique constraints

Review existing global unique constraints.

Codes belonging to independent organizations should generally be unique within an organization, not globally.

Change appropriate constraints to composite constraints.

### Company

Replace global Company code uniqueness with:

```prisma
@@unique([organizationId, code])
```

### Port

Replace global Port code uniqueness with:

```prisma
@@unique([organizationId, code])
```

If UN/LOCODE is currently unique, decide whether it is intentionally global. Prefer organization-specific uniqueness for independently managed tenant data:

```prisma
@@unique([organizationId, unlocode])
```

PostgreSQL permits multiple null values in a unique constraint.

### Terminal

Use:

```prisma
@@unique([organizationId, portId, code])
```

### Berth

Use:

```prisma
@@unique([organizationId, terminalId, code])
```

### Vessel

Use tenant-specific IMO uniqueness unless the project explicitly documents global uniqueness:

```prisma
@@unique([organizationId, imoNumber])
```

If call sign is unique, make it tenant-specific:

```prisma
@@unique([organizationId, callSign])
```

### Service

Use:

```prisma
@@unique([organizationId, code])
```

Do not remove useful existing indexes.

Do not create duplicate indexes already covered by composite unique constraints unless they serve a documented query pattern.

## 8. Existing-data migration strategy

Existing records do not have `organizationId`, so a normal generated migration that immediately adds a required column may fail.

Create a safe customized migration.

Use:

```bash
npx prisma migrate dev --name add_organization_tenancy --create-only
```

Review and customize the generated `migration.sql` before applying it.

The migration must perform operations in this order:

1. Create enums.
2. Create `organizations`.
3. Create `users`.
4. Create `organization_members`.
5. Insert one default organization for existing data.
6. Add nullable `organizationId` columns to existing tables.
7. Backfill all existing rows using the default organization ID.
8. Verify no `organizationId` values remain null.
9. Change each `organizationId` column to `NOT NULL`.
10. Add foreign keys.
11. Replace global unique constraints with tenant-specific constraints.
12. Rename or safely map Service’s current `companyId`.
13. Add indexes.

Use a stable UUID for the default organization so the backfill is deterministic, for example:

```text
00000000-0000-4000-8000-000000000001
```

Insert:

```text
name: Default Organization
slug: default
isActive: true
```

Use the actual quoted column names produced by the existing Prisma schema.

Do not assume table or column names without inspecting the schema and existing migrations.

Before changing a column to `NOT NULL`, include a PostgreSQL guard that fails clearly if backfill did not succeed.

Do not use:

```bash
prisma migrate reset
```

Do not use:

```bash
prisma db push
```

Do not delete existing records.

Do not silently accept destructive migration warnings.

## 9. Relationship consistency review

After the migration, verify that existing related records all have the same organization:

* Terminal organization matches its Port organization.
* Berth organization matches its Terminal organization.
* Service organization matches its operator Company organization.
* VesselSchedule organization matches its Service organization.
* VesselSchedule organization matches its Vessel organization.
* VesselSchedule organization matches its Terminal organization.
* If assigned, VesselSchedule organization matches its Berth organization.

For this prompt, report inconsistent records if any exist.

Do not automatically move records between organizations.

API-level enforcement will be implemented in Prompt 2.

## 10. Generated Prisma client

After applying the migration, regenerate Prisma Client:

```bash
npx prisma generate
```

Update TypeScript types only where required to make the project compile.

Because API tenant enforcement is deferred to Prompt 2, do not make partial security claims. Clearly report that APIs are not yet tenant-secure until Prompt 2 is completed.

## 11. Verification

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

Also verify through read-only database queries:

* Default organization exists.
* Every Company has `organizationId`.
* Every Port has `organizationId`.
* Every Terminal has `organizationId`.
* Every Berth has `organizationId`.
* Every Vessel has `organizationId`.
* Every Service has `organizationId`.
* Every VesselSchedule has `organizationId`.
* Existing record counts did not decrease.
* Existing Service operator-company relationships remain intact.
* Migration history is healthy.

## Important stop conditions

Stop and report instead of guessing if:

* Prisma migration history is already broken.
* The Berth migration is still missing or incorrectly ordered.
* The VesselSchedule migration still fails in the shadow database.
* An existing migration has already been modified after deployment.
* Existing tables contain inconsistent parent-child organization ownership.
* The Service company relation cannot be preserved without data loss.
* Prisma proposes dropping a populated table or column.
* Applying the migration would require resetting the database.
* Production data ownership cannot be determined safely.

## Final report

Report:

* Files modified
* Migration folder created
* Default organization ID and slug
* Tables receiving `organizationId`
* Unique constraints changed
* Service relationship changes
* Existing record counts before and after
* Relationship consistency results
* Prisma validation result
* Migration status
* Lint result
* Build result
* Any pre-existing warnings
* Any manual action still required

Stop after Prompt 1 is complete. Do not begin authentication, request approval, invitations, permissions, or Audit Log.

---

# Prompt 2 of 5 — Authentication, Organization Context, and Tenant-Safe APIs

Implement Supabase authentication, active-organization context, role authorization, and organization data isolation for this Vessel Schedule project.

Prompt 1 has already added:

* `Organization`
* `User`
* `OrganizationMember`
* `PlatformRole`
* `OrganizationRole`
* `organizationId` on tenant-owned models
* Tenant-specific unique constraints
* A default organization for existing data

This prompt covers:

1. Supabase Auth integration
2. Login and logout
3. Password recovery
4. Application User resolution
5. Active organization selection
6. Organization role authorization
7. Tenant scoping for every operational API
8. UI authentication state
9. Initial Super Admin bootstrap
10. Cross-organization isolation testing

Do not implement yet:

* Public organization-request form
* Organization-request approval
* Member invitations
* Member management
* Audit Log
* Berth Planner

Those belong to Prompts 3–5.

## Project context

The project uses:

* Next.js App Router
* React
* TypeScript
* Prisma
* PostgreSQL/Supabase
* Tailwind CSS

Existing modules:

* Company
* Port
* Terminal
* Berth
* Vessel
* Service
* VesselSchedule

Before writing code:

* Inspect the complete Prisma schema.
* Inspect the migration created by Prompt 1.
* Run `npx prisma migrate status`.
* Confirm every tenant-owned table has a required `organizationId`.
* Inspect `package.json`.
* Inspect local Next.js documentation under `node_modules/next/dist/docs/`.
* Determine whether this Next.js version uses `middleware.ts` or `proxy.ts`.
* Follow the installed Next.js version rather than outdated examples.
* Inspect the existing application shell and navigation.
* Inspect every GET, POST, and PATCH route.
* Preserve existing response shapes and business validation.

Stop and report if Prompt 1 is incomplete or migration history is unhealthy.

## 1. Dependencies

Use the current official Supabase SSR approach.

Install only if not already installed:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Do not install a separate authentication framework.

Do not expose server secrets to browser code.

Expected public environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

If the project uses the older anon-key naming convention, follow the existing environment naming consistently.

A secret/service key must never use a `NEXT_PUBLIC_` prefix.

Do not print environment-variable values.

Update `.env.example` with variable names and safe placeholder values only.

## 2. Supabase clients

Create simple Supabase utilities using the installed official SSR API.

Suggested structure:

```text
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/proxy.ts
```

Requirements:

* Browser client for Client Components.
* Server client for Server Components and route handlers.
* Cookie-aware session refresh in `proxy.ts` or `middleware.ts`, depending on the installed Next.js version.
* Do not create a new Supabase client independently in every component.
* Never use the secret/service key in the browser.
* Do not rely only on locally decoded session data for authorization.
* Resolve the verified authenticated user on the server.

Follow the current APIs installed in `node_modules`. Do not copy deprecated Supabase Auth Helper examples.

## 3. Route protection

Public routes:

```text
/login
/forgot-password
/reset-password
/request-access
/auth/callback
```

`/request-access` will be implemented in Prompt 3, but it should remain public.

Public API routes:

```text
/api/health
```

All master-data and operational pages require authentication:

```text
/companies
/ports
/terminals
/berths
/vessels
/services
/schedules
/berth-planner
/settings
/admin
```

All operational APIs require authentication:

```text
/api/companies
/api/ports
/api/terminals
/api/berths
/api/vessels
/api/services
/api/schedules
```

The proxy or middleware should redirect unauthenticated page requests to:

```text
/login
```

Preserve a safe relative `next` destination where practical.

Do not redirect API requests to HTML login pages. API route handlers must return JSON:

```json
{
  "error": "Authentication required"
}
```

with status `401`.

Proxy or middleware protection is not sufficient by itself. Every protected API route must independently verify authentication and organization membership.

## 4. Authentication pages

Create a login page consistent with the current application theme:

```text
app/login/page.tsx
```

Support:

* Email
* Password
* Login button
* Loading state
* Clear errors
* Forgot-password link
* Request-access link

Do not provide public self-registration. New organizations must use the request-and-approval flow from Prompt 3. New organization members will use invitations from Prompt 4.

Create:

```text
app/forgot-password/page.tsx
app/reset-password/page.tsx
app/auth/callback/route.ts
```

Password recovery must:

* Accept an email.
* Use Supabase’s recovery flow.
* Return a generic success message that does not reveal whether an account exists.
* Redirect through the correct callback.
* Allow the user to set a new password.
* Handle expired or invalid links clearly.

Create logout behavior through a server route or server action consistent with the installed Next.js and Supabase SSR versions.

After logout:

```text
redirect to /login
```

## 5. Current application user

Create a reusable server-side authentication helper in a clear location such as:

```text
lib/auth/current-user.ts
lib/auth/auth-errors.ts
lib/auth/permissions.ts
```

Use a custom application error for expected authentication and authorization failures. Do not throw `NextResponse` objects from shared helpers or Prisma transactions.

The resolved current-user context should include:

```ts
type CurrentUserContext = {
  id: string;
  email: string;
  displayName: string;
  platformRole: "USER" | "SUPER_ADMIN";
  activeOrganization: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    role: "OWNER" | "ADMIN" | "PLANNER" | "VIEWER";
  };
  availableOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: "OWNER" | "ADMIN" | "PLANNER" | "VIEWER";
  }>;
};
```

Resolution flow:

1. Get the verified Supabase Auth user on the server.
2. Find the corresponding Prisma `User` by the Supabase UUID.
3. Confirm the Prisma User exists.
4. Confirm `User.isActive` is true.
5. Load active organization memberships.
6. Confirm the organization itself is active.
7. Determine the active organization.
8. Return the complete context.

Expected failures:

* No Supabase user: `401`
* Missing Prisma User profile: `403`
* Inactive Prisma User: `403`
* No active organization membership: `403`
* Inactive organization: `403`
* Invalid selected organization: fall back safely or return `403`

Do not automatically attach a user to an organization based only on their email domain.

Do not accept user ID, role, platform role, or organization membership from browser request bodies.

## 6. Active organization

A user may have multiple organization memberships.

Store the selected organization ID in a secure cookie:

```text
active_organization_id
```

Cookie requirements:

* `httpOnly`
* `sameSite=lax`
* `secure` in production
* Appropriate path
* Reasonable expiration

Treat the cookie value as untrusted.

Every server request must verify that the authenticated User has an active membership in that organization.

If no valid cookie exists:

* Choose the first active membership deterministically.
* Prefer OWNER, then ADMIN, then PLANNER, then VIEWER.
* Set or return the selected organization safely where supported.

Create:

```text
POST /api/auth/active-organization
GET  /api/auth/me
```

POST body:

```json
{
  "organizationId": "uuid"
}
```

Validate:

* Authenticated user
* Organization exists
* Organization is active
* User has active membership
* Never permit arbitrary organization selection

`GET /api/auth/me` returns the current-user context without exposing secrets.

Add an organization switcher to the application shell when the user has more than one active membership.

After switching:

* Refresh the page.
* Reload tenant-scoped data.
* Do not retain records from the previous organization in client state.

## 7. Permission model

Implement permissions in one small, explicit helper.

Use this initial matrix:

| Capability                      | Owner | Admin | Planner | Viewer |
| ------------------------------- | ----: | ----: | ------: | -----: |
| View master data                |   Yes |   Yes |     Yes |    Yes |
| Create/edit master data         |   Yes |   Yes |      No |     No |
| Activate/deactivate master data |   Yes |   Yes |      No |     No |
| View schedules                  |   Yes |   Yes |     Yes |    Yes |
| Create/edit schedules           |   Yes |   Yes |     Yes |     No |
| Cancel schedules                |   Yes |   Yes |     Yes |     No |
| Manage organization members     |   Yes |   Yes |      No |     No |
| Change Admin roles              |   Yes |    No |      No |     No |
| Transfer ownership              |   Yes |    No |      No |     No |
| Platform administration         |    No |    No |      No |     No |

`SUPER_ADMIN` is a platform role. It must not silently bypass organization scoping for normal operational APIs. A Super Admin should still operate within an explicitly selected organization.

Create clear helper functions, for example:

```ts
requireAuthenticatedUser()
requireActiveOrganization()
requireOrganizationRole(...)
requirePlatformRole(...)
canManageMasterData(...)
canManageSchedules(...)
```

Keep APIs simple and explicit. Do not create an overly generic policy engine.

Server-side authorization is mandatory. Hiding buttons is only a usability improvement.

## 8. Tenant-safe API conversion

Update all operational route handlers:

```text
Company
Port
Terminal
Berth
Vessel
Service
VesselSchedule
```

Every GET, POST, and PATCH must resolve:

```ts
const currentUser = await requireCurrentUser();
const organizationId = currentUser.activeOrganization.id;
```

### GET rules

Every list query must include:

```ts
where: {
  organizationId,
}
```

Combine it safely with existing filters.

Do not return another organization’s records through included relationships.

### Single-record rules

For tenant-owned records, do not query only by ID:

```ts
// Unsafe
prisma.vessel.findUnique({
  where: { id },
});
```

Use:

```ts
const vessel = await prisma.vessel.findFirst({
  where: {
    id,
    organizationId,
  },
});
```

If not found, return `404`.

Do not reveal whether that ID exists in another organization.

### Create rules

Never accept `organizationId` from the request body.

Create using:

```ts
data: {
  organizationId,
  // validated fields
}
```

Ignore or reject any `organizationId` present in a request body.

Require OWNER or ADMIN for master-data creation.

Require OWNER, ADMIN, or PLANNER for schedule creation.

### Update rules

Before update:

1. Find the record by `id` and `organizationId`.
2. Return `404` if unavailable.
3. Apply the appropriate role check.
4. Update only the authorized tenant record.

If Prisma requires a unique selector for update after the scoped lookup, it is acceptable to update by the verified record ID inside the same request. Prefer a compound tenant selector where the current schema supports it.

### Duplicate validation

All duplicate checks must include `organizationId`.

Example:

```ts
const duplicate = await prisma.service.findFirst({
  where: {
    organizationId,
    code,
    id: {
      not: currentId,
    },
  },
});
```

Do not report duplicates from another organization.

## 9. Cross-organization relationship validation

Every relationship must belong to the active organization.

### Terminal

Selected Port must match:

```ts
{
  id: portId,
  organizationId,
}
```

### Berth

Selected Terminal must match:

```ts
{
  id: terminalId,
  organizationId,
}
```

### Service

Selected operator Company must:

* Belong to `organizationId`
* Have type `SHIPPING_LINE`
* Satisfy existing active-status rules

Use the current Prisma field name established by Prompt 1, such as `operatorCompanyId`.

### VesselSchedule

The selected records must all belong to the active organization:

* Service
* Vessel
* Terminal
* Berth, if provided

Also validate:

* Berth belongs to selected Terminal.
* Existing date validation remains unchanged.
* Existing berth-position validation remains unchanged.
* Existing overlap validation is restricted to `organizationId`.
* Duplicate/conflict queries never compare against another organization’s schedules.

A valid UUID from another organization must behave like a missing record.

## 10. API error handling

Use consistent JSON errors:

```json
{
  "error": "Authentication required"
}
```

```json
{
  "error": "You do not have permission to perform this action"
}
```

Status codes:

* `400`: invalid input
* `401`: not authenticated
* `403`: authenticated but not authorized or inactive
* `404`: tenant-owned record not found
* `409`: tenant-scoped conflict
* `500`: unexpected failure

Do not expose:

* Supabase tokens
* Cookies
* Database errors
* Stack traces
* Whether another organization owns a requested record

## 11. UI authentication state

Update the application shell to show:

* Current user display name
* Current user email
* Active organization name
* Organization role
* Organization switcher when multiple memberships exist
* Logout action

Navigation visibility:

* Viewer: read-only navigation
* Planner: schedules plus read-only master data
* Admin and Owner: full organization navigation
* Platform administration links only for `SUPER_ADMIN`

Do not rely on navigation hiding for security.

Hide or disable master-data mutation buttons for Planner and Viewer.

Hide or disable schedule mutation buttons for Viewer.

Show a clear read-only indication when appropriate.

Avoid flashing unauthorized buttons before current-user data loads.

## 12. Initial Super Admin bootstrap

The guest approval flow in Prompt 3 requires an initial platform Super Admin.

Do not hardcode a user ID, email, or password.

Do not create a default password.

Create a safe one-time bootstrap script, for example:

```text
scripts/bootstrap-super-admin.ts
```

Expected workflow:

1. The developer manually creates or invites the initial user in Supabase Auth.
2. The developer obtains that Auth user’s UUID.
3. The bootstrap script receives:

   * Supabase Auth user UUID
   * Email
   * Display name
   * Existing organization slug, normally `default`
4. The script creates or updates the Prisma User.
5. It sets `platformRole` to `SUPER_ADMIN`.
6. It creates an active OWNER membership in the default organization.
7. It refuses unsafe ambiguous operations.
8. It prints no secrets.

Read inputs from explicit task-specific environment variables or safe CLI arguments.

Suggested environment names:

```text
BOOTSTRAP_AUTH_USER_ID
BOOTSTRAP_USER_EMAIL
BOOTSTRAP_USER_DISPLAY_NAME
BOOTSTRAP_ORGANIZATION_SLUG
```

Validate:

* UUID format
* Normalized email
* Organization exists
* Organization is active
* Supabase user ID is not already attached to a conflicting profile
* Email is not attached to another User ID

Make the operation idempotent.

Add an npm script such as:

```json
{
  "bootstrap:super-admin": "tsx scripts/bootstrap-super-admin.ts"
}
```

Document the manual bootstrap steps without including real credentials.

Do not run the bootstrap unless the required values are intentionally configured.

## 13. Security considerations

* Do not store passwords in Prisma.
* Do not log access tokens, refresh tokens, cookies, or passwords.
* Do not expose a Supabase secret/service key to Client Components.
* Do not trust role or organization information from the browser.
* Do not derive authorization only from editable user metadata.
* Derive application roles from Prisma membership records.
* Validate the active-organization cookie on every request.
* Scope every Prisma operation to the active organization.
* Do not use `prisma db push`.
* Do not reset the database.
* Preserve existing data.
* Do not claim Row Level Security protection unless RLS policies are actually implemented and tested.
* Prisma API scoping remains mandatory even if RLS is added later.

## 14. Manual isolation tests

Create or document a safe test plan using two organizations:

```text
Organization A
Organization B
```

Create users:

```text
Owner A → Organization A
Owner B → Organization B
Viewer A → Organization A
Planner A → Organization A
```

Verify:

1. Owner A sees only Organization A records.
2. Owner B sees only Organization B records.
3. Owner A cannot retrieve Organization B records by guessed UUID.
4. Owner A cannot update Organization B records.
5. Owner A cannot use Organization B relationship IDs in creates.
6. Duplicate codes may exist independently in A and B.
7. Viewer A cannot create or edit data.
8. Planner A can edit schedules but not master data.
9. Invalid organization-switch requests return `403`.
10. Switching organizations reloads all displayed data.
11. Unauthenticated API requests return JSON `401`.
12. Unauthenticated page requests redirect to login.
13. `/api/health` remains available if intended.
14. A Super Admin does not accidentally see all tenant data through normal APIs.

Do not use production customer data for tests.

## 15. Verification

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

If tests exist, run them.

Fix errors introduced by this prompt.

Do not modify unrelated code solely to remove pre-existing warnings.

## Stop conditions

Stop and report instead of guessing if:

* Prompt 1 migration is not applied.
* Tenant-owned tables lack `organizationId`.
* Migration history is unhealthy.
* Installed Next.js/Supabase APIs differ from expected examples.
* Existing authentication code conflicts with this design.
* Completing the work requires database reset.
* Any operation could expose or overwrite another organization’s data.
* Existing data has inconsistent organization relationships.
* A secret key appears in browser-accessible code.
* Cross-organization isolation cannot be demonstrated.

## Final report

Report:

* Dependencies added
* Environment variable names required
* Auth files created
* Login/recovery pages created
* Proxy or middleware behavior
* Current-user helper behavior
* Active-organization behavior
* Permission matrix implemented
* APIs converted to tenant scoping
* Relationship validations added
* UI authorization changes
* Bootstrap script created
* Manual setup still required
* Isolation test results
* Prisma validation result
* Migration status
* Lint result
* Build result
* Any pre-existing warnings

Clearly state:

```text
Prompt 2 complete
```

Then stop. Do not begin guest requests, approvals, invitations, or Audit Log.

---

# Prompt 3 of 5 — Guest Organization Request and Super Admin Approval

Implement the public organization-request and platform approval workflow for this Vessel Schedule project.

Prompts 1 and 2 have already implemented:

* Organization-based multi-tenancy
* User profiles
* Organization memberships
* Supabase authentication
* Login, logout, and password recovery
* Active organization context
* Platform and organization roles
* Tenant-scoped operational APIs
* A bootstrapped `SUPER_ADMIN`

This prompt covers:

1. Public organization request form
2. OrganizationRequest database model
3. Super Admin request list and details
4. Request approval
5. Organization creation
6. Supabase invitation for the first Owner
7. Prisma User and OWNER membership creation
8. Request rejection
9. Approval failure handling and safe retries

Do not implement yet:

* Invitations sent by organization Owners/Admins
* Organization member management
* Organization role changes
* Audit Log
* Berth Planner

Those belong to Prompts 4 and 5.

## Before writing code

* Inspect the full Prisma schema.
* Inspect the authentication implementation from Prompt 2.
* Inspect the current-user and permission helpers.
* Inspect the Supabase browser, server, and proxy clients.
* Inspect the Super Admin bootstrap implementation.
* Inspect the application shell and navigation.
* Inspect local Next.js documentation under `node_modules/next/dist/docs/`.
* Run `npx prisma migrate status`.
* Confirm Prompt 2 authentication and tenant isolation are working.
* Preserve existing data and API behavior.

Stop and report if:

* Migration history is unhealthy.
* Authentication is incomplete.
* No working `SUPER_ADMIN` exists.
* The secret/server Supabase client cannot be implemented safely.
* A secret key is exposed to browser code.
* Completion would require a database reset.

## 1. Environment configuration

The approval workflow needs Supabase’s Admin Auth API to invite the first organization Owner.

Use a server-only environment variable:

```env
SUPABASE_SECRET_KEY=
```

If the project already uses the older service-role variable name, follow the existing convention consistently.

Rules:

* Never prefix it with `NEXT_PUBLIC_`.
* Never import it into a Client Component.
* Never return it from an API.
* Never log it.
* Never include a real value in `.env.example`.
* Add only a safe placeholder to `.env.example`.

Create a separate server-only Supabase Admin client, for example:

```text
lib/supabase/admin.ts
```

Requirements:

* Create it only in server code.
* Disable browser-style token persistence.
* Use it only for trusted administrative operations.
* Do not reuse it for ordinary signed-in-user requests.
* Do not expose it through a public module imported by Client Components.

## 2. Prisma request model

Add:

```prisma
enum OrganizationRequestStatus {
  PENDING
  APPROVING
  APPROVED
  REJECTED
  APPROVAL_FAILED
  CANCELLED
}
```

Add:

```prisma
model OrganizationRequest {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  organizationName String @db.VarChar(200)
  requestedSlug    String? @db.VarChar(100)

  requesterName  String  @db.VarChar(200)
  requesterEmail String  @db.VarChar(255)
  phone          String? @db.VarChar(50)
  message        String?

  status OrganizationRequestStatus @default(PENDING)

  organizationId String?       @db.Uuid
  organization   Organization? @relation(
    fields: [organizationId],
    references: [id],
    onDelete: SetNull
  )

  authUserId String? @db.Uuid

  reviewedById String? @db.Uuid
  reviewedBy   User?   @relation(
    "OrganizationRequestReviewer",
    fields: [reviewedById],
    references: [id],
    onDelete: SetNull
  )

  reviewedAt DateTime?
  reviewNotes String?

  approvalStartedAt DateTime?
  invitationSentAt  DateTime?
  failureReason     String?  @db.VarChar(500)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([requesterEmail])
  @@index([status])
  @@index([organizationId])
  @@index([reviewedById])
  @@index([createdAt])
  @@map("organization_requests")
}
```

Add reverse relationships where required:

```prisma
// Organization
organizationRequests OrganizationRequest[]

// User
reviewedOrganizationRequests OrganizationRequest[]
  @relation("OrganizationRequestReviewer")
```

Adapt formatting to valid Prisma syntax.

Do not add passwords, tokens, invite links, cookies, or secrets to this table.

Create a migration:

```bash
npx prisma migrate dev --name add_organization_request
```

Do not use `prisma db push`.

Do not reset the database.

## 3. Public request API

Create:

```text
POST /api/organization-requests
```

This endpoint must be public.

Do not create a public GET endpoint.

Accept:

```json
{
  "organizationName": "Example Shipping",
  "requesterName": "Jane Doe",
  "requesterEmail": "jane@example.com",
  "phone": "+66...",
  "message": "Optional message",
  "website": ""
}
```

`website` is a hidden honeypot field. A normal user should leave it empty.

Validate using simple `if` statements:

* Organization name is required.
* Organization name maximum length: 200.
* Requester name is required.
* Requester name maximum length: 200.
* Email is required.
* Trim and lowercase email.
* Validate basic email structure.
* Email maximum length: 255.
* Phone is optional and maximum length 50.
* Message is optional and maximum length 2,000.
* Trim all strings.
* Convert empty optional values to `null`.
* Honeypot must be empty.

Do not accept:

* Request status
* Organization ID
* User ID
* Role
* Platform role
* Approval fields
* Auth user ID

Duplicate protection:

* Reject or safely reuse an existing request when the same normalized email already has status:

  * `PENDING`
  * `APPROVING`
  * `APPROVAL_FAILED`
* Do not create unlimited duplicate requests.
* Return a generic response that does not expose unnecessary internal state.

Use a generic successful response:

```json
{
  "message": "Your request has been received and will be reviewed."
}
```

Do not reveal:

* Whether the email already has a Supabase Auth account
* Whether the email belongs to an existing organization
* Internal approval notes
* User IDs
* Organization IDs

Add reasonable request throttling if the project already has a durable rate-limit mechanism.

If no durable rate limiter exists:

* Keep duplicate-request protection.
* Keep the honeypot.
* Add a clear TODO explaining that production needs durable rate limiting or CAPTCHA.
* Do not claim an in-memory serverless limiter is reliable production protection.

## 4. Public request page

Create:

```text
app/request-access/page.tsx
components/auth/request-access-form.tsx
```

The page must remain accessible without authentication.

Display:

```text
Request Access
Request an organization account for the Vessel Schedule system
```

Fields:

* Organization name
* Your name
* Work email
* Phone, optional
* Message, optional
* Hidden honeypot
* Submit button

Requirements:

* Match the Login page’s visual theme.
* Accessible labels.
* Loading state.
* Clear validation errors.
* Generic success state.
* Disable duplicate submissions.
* Link back to Login.
* Do not allow role selection.
* Do not allow selecting an existing organization.
* Do not collect a password.

After successful submission, replace the form with a confirmation message.

## 5. Super Admin APIs

Create:

```text
GET  /api/admin/organization-requests
GET  /api/admin/organization-requests/[id]
POST /api/admin/organization-requests/[id]/approve
POST /api/admin/organization-requests/[id]/reject
```

Every admin endpoint must:

1. Require authentication.
2. Require `platformRole === SUPER_ADMIN`.
3. Return `401` when unauthenticated.
4. Return `403` when not a Super Admin.
5. Never rely only on hidden navigation.
6. Never operate using organization-level OWNER/ADMIN permission alone.

### List API

Support:

```text
page
pageSize
search
status
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

Search fields:

* Organization name
* Requester name
* Requester email
* Phone

Sort newest first.

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

Return the complete non-secret request details and related approved organization summary when present.

Do not return secret keys, tokens, session information, or invitation links.

## 6. Slug generation

Generate an organization slug during approval.

Rules:

* Lowercase
* ASCII letters and numbers
* Single hyphens between words
* No leading or trailing hyphen
* Maximum 100 characters
* Must be unique
* Append a deterministic numeric suffix if necessary

Example:

```text
Ocean Network Express → ocean-network-express
```

If already used:

```text
ocean-network-express-2
```

Do not trust a guest-provided slug without normalization and uniqueness checks.

The Super Admin may edit the proposed slug before approval, but the server must still normalize and validate it.

## 7. Approval workflow

Approval is a cross-system operation involving PostgreSQL and Supabase Auth. It cannot be one fully atomic Prisma transaction.

Make it idempotent and safely retryable.

Approve request body:

```json
{
  "organizationName": "Approved Organization Name",
  "slug": "approved-slug",
  "reviewNotes": "Optional internal notes"
}
```

Only the Super Admin can choose or modify these values.

### Approval prechecks

Before changing anything:

* Request exists.
* Status is `PENDING` or `APPROVAL_FAILED`.
* Request has not already been approved.
* Request has not been rejected or cancelled.
* Normalized email is valid.
* Organization name is valid.
* Slug is valid and available, unless it belongs to the already-linked organization from a retry.
* No conflicting Prisma User uses the same email with a different ID.
* No conflicting organization has already been created for this request.

Use conditional state transitions to reduce concurrent double approval.

Move the request to:

```text
APPROVING
```

and record:

* `reviewedById`
* `approvalStartedAt`
* Clear previous `failureReason`

Only one concurrent request should successfully claim approval.

### Approval stages

Implement these stages:

#### Stage 1: create or reuse Organization

Create the Organization with:

```text
name
slug
isActive = true
```

Immediately store its ID on `OrganizationRequest.organizationId`.

On retry:

* Reuse the linked organization.
* Do not create a duplicate.
* Confirm it was created for this request.
* Do not attach an unrelated organization accidentally.

#### Stage 2: invite requester through Supabase

Use the server-only Supabase Admin client:

```ts
supabase.auth.admin.inviteUserByEmail(...)
```

Use a safe redirect URL based on an explicitly configured application origin, for example:

```env
NEXT_PUBLIC_APP_URL=
```

Redirect to the existing Auth callback and then to a safe welcome or application page.

Include only minimal non-authoritative metadata such as display name.

Do not place organization roles or trusted authorization data solely in editable user metadata.

Store the returned Auth user UUID in:

```text
OrganizationRequest.authUserId
```

Store:

```text
invitationSentAt
```

Do not store the invitation URL or token.

Supabase invitation must happen only on the server.

### Existing Auth user behavior

This guest-onboarding flow is intended primarily for a new Auth user.

If Supabase reports that the email already belongs to a confirmed Auth user:

* Do not scan or enumerate the entire Auth user list.
* Do not attach the organization based only on matching unverified request data.
* Set the request to `APPROVAL_FAILED`.
* Store a safe internal failure reason such as:

  * `Email already belongs to an existing account; manual verified linking is required.`
* Show the Super Admin a clear recovery message.
* Do not expose this detail through the public request endpoint.
* Do not create a second Auth user.
* Do not mark the request approved.

A later enhancement may allow an authenticated existing user to request a new organization.

#### Stage 3: create Prisma User and OWNER membership

Using the verified Auth UUID returned by Supabase:

* Create or safely upsert the Prisma User.
* Require the normalized email to match.
* Set:

  * `displayName = requesterName`
  * `platformRole = USER`
  * `isActive = true`
* Do not overwrite an existing `SUPER_ADMIN` platform role.
* Do not attach an Auth UUID to a conflicting email.
* Create an active `OWNER` OrganizationMember record.
* Make membership creation idempotent.
* Do not downgrade an existing OWNER membership.
* Do not create membership until a verified Auth UUID is available.

Use one Prisma transaction for:

* User create/update
* Membership create/update
* Request finalization

After successful completion:

```text
status = APPROVED
reviewedAt = now
failureReason = null
```

### Failure handling

If any approval stage fails:

* Do not delete successfully created external resources blindly.
* Preserve `organizationId` and `authUserId` when already known.
* Set request status to `APPROVAL_FAILED`.
* Save a safe internal `failureReason`.
* Do not expose raw secret-bearing SDK errors.
* Log a server-side error without tokens or keys.
* Allow a Super Admin to retry safely.
* Retry must reuse completed stages.
* Retry must not send unnecessary duplicate invitations.
* Retry must not create duplicate organizations, users, or memberships.

If invitation was sent but final database work failed, retry should use the stored `authUserId` instead of sending another invitation where possible.

## 8. Rejection workflow

Reject body:

```json
{
  "reviewNotes": "Reason for rejection"
}
```

Rules:

* Only `PENDING` requests can normally be rejected.
* Require review notes.
* Maximum length: 2,000.
* Record:

  * `status = REJECTED`
  * `reviewedById`
  * `reviewedAt`
  * `reviewNotes`
* Do not create an Organization.
* Do not create a User.
* Do not create a membership.
* Do not send an Auth invitation.
* Rejecting an already approved request must fail with `409`.
* Do not expose internal rejection notes publicly.

Do not implement organization deletion as part of rejection.

## 9. Super Admin UI

Create:

```text
app/admin/organization-requests/page.tsx
components/admin/organization-request-manager.tsx
```

Add navigation under:

```text
Platform Administration
- Organization Requests
```

Only show this navigation group to `SUPER_ADMIN`.

API authorization remains mandatory.

### List page

Display:

* Request date
* Organization name
* Requester name
* Requester email
* Status
* Reviewed date
* Actions

Filters:

* Search
* Status
* Date range
* Clear filters

Use server-side pagination.

Status badges:

* PENDING: amber
* APPROVING: blue
* APPROVED: green
* REJECTED: red or gray
* APPROVAL_FAILED: red
* CANCELLED: gray

### Details drawer

Display:

* Organization name
* Requested slug
* Requester name
* Email
* Phone
* Message
* Status
* Submitted date
* Reviewer
* Review notes
* Linked organization, when present
* Invitation-sent date
* Safe failure reason, for Super Admin only

Actions:

* Approve
* Reject
* Retry approval when status is `APPROVAL_FAILED`

Approval form:

* Organization name
* Organization slug
* Review notes, optional
* Clear confirmation that approval creates an organization and invites the first Owner

Rejection form:

* Required review notes
* Clear confirmation

Disable actions while processing.

Prevent duplicate submissions.

Refresh the list and details after success.

Do not show invitation tokens or secret data.

## 10. Welcome behavior

After the invited first Owner accepts the Supabase invitation and signs in:

* The existing Auth callback should establish the session.
* The Prisma User should already exist.
* The OWNER membership should already exist.
* Active-organization resolution should select the new organization.
* The user should see an empty organization workspace.
* The user must not see the default organization’s records.
* The user can later create their own Company, Port, Terminal, Berth, Vessel, Service, and Schedule records according to Prompt 2 permissions.

If needed, create a simple authenticated welcome page:

```text
/welcome
```

It may display:

* User name
* Organization name
* OWNER role
* Link to begin setup

Do not implement member invitations on this page yet.

## 11. Security requirements

* Public users can only submit requests.
* Public users cannot list or inspect requests.
* Public users cannot approve or reject requests.
* Organization Owners cannot access platform approval APIs.
* Only `SUPER_ADMIN` can review requests.
* Server derives reviewer ID from authenticated context.
* Never accept `reviewedById` from request bodies.
* Never expose `SUPABASE_SECRET_KEY`.
* Never store passwords or invite tokens in Prisma.
* Never trust role values from Supabase user metadata.
* Roles come from Prisma.
* Normalize email consistently.
* Avoid account enumeration in public responses.
* Use safe relative redirects.
* Do not accept arbitrary external redirect URLs.
* Validate request IDs and organization IDs.
* Do not log complete Supabase Admin responses.
* Do not expose raw database or SDK errors.

## 12. Basic manual checks

Verify:

1. Guest can open `/request-access`.
2. Guest can submit a valid request.
3. Guest cannot access the admin request list.
4. Duplicate pending requests do not create unlimited records.
5. Honeypot submissions are rejected or silently ignored safely.
6. Normal OWNER cannot access admin APIs.
7. `SUPER_ADMIN` can view pending requests.
8. Approval creates one Organization.
9. Approval sends one invitation.
10. Approval creates one Prisma User using the Supabase Auth UUID.
11. Approval creates one OWNER membership.
12. Approved Owner sees only their new organization.
13. Approved Owner cannot see default-organization records.
14. Rejection creates no organization or user.
15. Double-clicking Approve does not create duplicates.
16. Retrying `APPROVAL_FAILED` does not create duplicates.
17. Public API responses do not reveal whether an email already exists.
18. Secret/service keys do not appear in browser JavaScript or Network requests.
19. Unauthenticated admin APIs return `401`.
20. Non-Super-Admin admin API requests return `403`.

## 13. Verification

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

Do not modify unrelated code solely to remove existing warnings.

## Final report

Report:

* Dependencies added, if any
* Environment variable names required
* Prisma model and migration created
* Public request endpoint
* Public request page
* Super Admin endpoints
* Super Admin UI
* Organization creation behavior
* Supabase invitation behavior
* First OWNER creation behavior
* Approval retry behavior
* Rejection behavior
* Security checks
* Manual test results
* Prisma validation result
* Migration status
* Lint result
* Build result
* Remaining pre-existing warnings
* Manual setup still required

Clearly state:

```text
Prompt 3 complete
```

Then stop. Do not begin member invitations or Audit Log.

---

# Prompt 4 of 5 — Organization Invitations and Member Management

Implement organization member invitations, invitation acceptance, member management, role changes, and ownership transfer for this Vessel Schedule project.

Prompts 1–3 have already implemented:

* Organization-based multi-tenancy
* Supabase authentication
* Prisma User profiles
* Organization memberships
* Platform and organization roles
* Active organization context
* Tenant-scoped APIs
* Public organization requests
* Super Admin approval
* First Owner onboarding

This prompt covers:

1. OrganizationInvitation database model
2. Owner/Admin invitation workflow
3. New Supabase Auth user invitation
4. Existing Auth user invitation
5. Authenticated invitation acceptance
6. Organization member list
7. Role changes
8. Member activation/deactivation
9. Invitation revoke/resend
10. Safe ownership transfer

Do not implement yet:

* Audit Log
* Berth Planner
* Billing
* Custom organization permissions
* Organization deletion

Audit Log belongs to Prompt 5.

## Before writing code

* Inspect the complete Prisma schema.
* Inspect the authentication and current-user helpers.
* Inspect active-organization selection.
* Inspect the Supabase server and Admin clients.
* Inspect the Prompt 3 first-Owner invitation flow.
* Inspect role and permission helpers.
* Inspect the application shell and shared UI components.
* Inspect local Next.js documentation under `node_modules/next/dist/docs/`.
* Run `npx prisma migrate status`.
* Confirm Prompt 3 is complete.
* Preserve all existing user, organization, and membership data.

Stop and report if:

* Authentication is incomplete.
* Migration history is unhealthy.
* Active organization resolution is not secure.
* Supabase Admin secrets are exposed to client code.
* First Owner onboarding is incomplete.
* Completing the work requires resetting or dropping the database.

## 1. Invitation enums

Add:

```prisma
enum OrganizationInvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

enum InvitationDeliveryStatus {
  NOT_ATTEMPTED
  SENT
  EXISTING_ACCOUNT
  FAILED
}
```

Meanings:

* `PENDING`: invitation can still be accepted.
* `ACCEPTED`: membership was created.
* `EXPIRED`: expiration time passed.
* `REVOKED`: Owner/Admin revoked the invitation.
* `SENT`: Supabase invitation email was successfully requested.
* `EXISTING_ACCOUNT`: email already belongs to an existing Auth account; user can accept after signing in.
* `FAILED`: invitation email could not be sent and may be retried.

## 2. OrganizationInvitation model

Add:

```prisma
model OrganizationInvitation {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  organizationId String       @db.Uuid
  organization   Organization @relation(
    fields: [organizationId],
    references: [id],
    onDelete: Cascade
  )

  email       String  @db.VarChar(255)
  displayName String? @db.VarChar(200)
  role        OrganizationRole

  status         OrganizationInvitationStatus @default(PENDING)
  deliveryStatus InvitationDeliveryStatus     @default(NOT_ATTEMPTED)

  pendingKey String? @unique @db.VarChar(300)

  authUserId String? @db.Uuid

  invitedById String @db.Uuid
  invitedBy   User   @relation(
    "OrganizationInvitationInviter",
    fields: [invitedById],
    references: [id],
    onDelete: Restrict
  )

  acceptedById String? @db.Uuid
  acceptedBy   User?   @relation(
    "OrganizationInvitationAcceptor",
    fields: [acceptedById],
    references: [id],
    onDelete: SetNull
  )

  invitationSentAt DateTime?
  acceptedAt       DateTime?
  revokedAt        DateTime?
  expiresAt        DateTime

  deliveryError String? @db.VarChar(500)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([organizationId])
  @@index([email])
  @@index([status])
  @@index([expiresAt])
  @@index([invitedById])
  @@index([acceptedById])
  @@map("organization_invitations")
}
```

Add reverse relationships:

```prisma
// Organization
invitations OrganizationInvitation[]

// User
sentOrganizationInvitations OrganizationInvitation[]
  @relation("OrganizationInvitationInviter")

acceptedOrganizationInvitations OrganizationInvitation[]
  @relation("OrganizationInvitationAcceptor")
```

Adapt line formatting to valid Prisma syntax.

### `pendingKey`

Use `pendingKey` to prevent duplicate active invitations.

For a pending invitation, calculate:

```text
organizationId + ":" + normalizedEmail
```

Example:

```text
org-uuid:jane@example.com
```

When an invitation becomes:

* ACCEPTED
* EXPIRED
* REVOKED

set:

```text
pendingKey = null
```

This allows historical invitations while enforcing only one active invitation per organization and email.

Never accept `pendingKey` from a browser request.

Create a migration:

```bash
npx prisma migrate dev --name add_organization_invitations
```

Do not use `prisma db push`.

Do not reset the database.

## 3. Invitation permissions

Use the current active organization membership.

Rules:

### OWNER

Can:

* Invite ADMIN
* Invite PLANNER
* Invite VIEWER
* Revoke invitations
* Resend invitations
* Change ADMIN, PLANNER, and VIEWER roles
* Activate/deactivate non-Owner members
* Transfer ownership

Cannot:

* Invite another OWNER directly
* Remove the final Owner without transferring ownership

### ADMIN

Can:

* Invite PLANNER
* Invite VIEWER
* Revoke invitations they are permitted to manage
* Resend PLANNER/VIEWER invitations
* Change PLANNER to VIEWER
* Change VIEWER to PLANNER
* Activate/deactivate PLANNER and VIEWER members

Cannot:

* Invite OWNER
* Invite ADMIN
* Modify OWNER
* Modify ADMIN
* Promote anyone to ADMIN
* Transfer ownership
* Change platform roles

### PLANNER and VIEWER

Cannot manage members or invitations.

`SUPER_ADMIN` does not automatically bypass organization membership requirements through normal organization APIs.

All organization-management APIs must still operate within an explicitly active organization.

## 4. Create invitation API

Create:

```text
POST /api/organization/invitations
```

Body:

```json
{
  "email": "member@example.com",
  "displayName": "Member Name",
  "role": "PLANNER"
}
```

Validate:

* Authenticated user
* Active organization
* Active membership
* OWNER or ADMIN permission
* Email required
* Normalize email to lowercase
* Basic email validation
* Maximum email length 255
* Display name optional, trimmed, maximum 200
* Role required
* Role must be permitted for the inviter
* Role can never be OWNER through invitation
* Organization is active
* Email is not already an active organization member
* No unexpired PENDING invitation exists
* `pendingKey` must be calculated on the server
* Default expiration: seven days

Never accept:

* Organization ID
* Invited-by User ID
* Auth user ID
* Invitation status
* Delivery status
* Pending key
* Platform role
* Accepted-by User ID

### Database-first behavior

Create the pending invitation in Prisma before attempting email delivery.

This preserves the invitation if the external email operation fails.

Then attempt Supabase invitation delivery.

### New Auth user

Use the server-only Supabase Admin API:

```ts
supabase.auth.admin.inviteUserByEmail(...)
```

Redirect safely to:

```text
/auth/callback?next=/invitations
```

Use the configured application origin.

Include only minimal non-authoritative metadata, such as display name.

If successful:

* Store returned `authUserId`.
* Set `deliveryStatus = SENT`.
* Set `invitationSentAt`.
* Clear `deliveryError`.

Do not create the OrganizationMember yet. Membership is created only after acceptance.

### Existing Auth user

If Supabase reports that the email already belongs to an existing confirmed Auth user:

* Keep invitation status `PENDING`.
* Set `deliveryStatus = EXISTING_ACCOUNT`.
* Do not create another Auth user.
* Do not scan the complete Auth user list.
* Do not attach a User merely from an unverified request.
* Show the inviter a safe message:

  * `The invitation was created. The existing user can accept it after signing in.`
* The invitation should appear automatically on the existing user’s invitation page after verified login.

Do not expose whether an arbitrary email has an account through a public endpoint. This endpoint is restricted to authorized organization managers.

### Other delivery failures

If delivery fails for another reason:

* Keep invitation status `PENDING`.
* Set `deliveryStatus = FAILED`.
* Store a safe, short `deliveryError`.
* Do not store secret-bearing SDK details.
* Permit retry.
* Do not create duplicate invitations when retrying.

Return the created invitation and a clear delivery result.

## 5. Pending invitations for the signed-in user

Create:

```text
GET /api/invitations/mine
```

This endpoint requires a verified Supabase Auth user but must work even when:

* No Prisma User exists yet
* No OrganizationMember exists yet
* The user has no active organization

This is necessary for newly invited users.

Do not use a helper that requires an existing membership.

Instead:

1. Get the verified Supabase Auth user.
2. Obtain the verified normalized email.
3. Find PENDING invitations matching that exact email.
4. Require `expiresAt > now`.
5. Require the Organization to be active.
6. Return only invitations for that verified email.

Do not accept an email query parameter.

Do not return invitations for an email supplied by the browser.

Return:

```json
{
  "data": []
}
```

Include:

* Invitation ID
* Organization name
* Organization slug
* Proposed role
* Inviter display name
* Expiration
* Delivery status

Do not expose internal delivery errors to the invitee.

When loading invitations, expired pending invitations may be updated opportunistically:

```text
status = EXPIRED
pendingKey = null
```

Do this safely.

## 6. Invitation acceptance

Create:

```text
POST /api/invitations/[id]/accept
```

This route must work for an authenticated Supabase user who does not yet have a Prisma User profile.

Body may contain:

```json
{
  "displayName": "Confirmed Display Name"
}
```

Acceptance validation:

* Verified Supabase Auth user exists.
* Verified Auth email exists.
* Invitation exists.
* Invitation status is PENDING.
* Invitation is not expired.
* Invitation email exactly matches normalized verified Auth email.
* Organization is active.
* If `authUserId` is stored, it must match the authenticated Auth user ID.
* Display name is required only if no valid User profile/display name exists.
* Display name maximum length 200.
* No conflicting Prisma User has the same email with another UUID.
* No conflicting Prisma User uses the Auth UUID with another email.
* Membership does not already exist in a conflicting state.

Use one Prisma transaction:

1. Re-read and validate the invitation.
2. Create or safely update the Prisma User:

   * `id = verified Supabase Auth UUID`
   * `email = verified normalized email`
   * `displayName`
   * `platformRole = USER` for a new user
   * `isActive = true`
3. Never downgrade an existing `SUPER_ADMIN`.
4. Create or reactivate OrganizationMember with the invited role.
5. Set invitation:

   * `status = ACCEPTED`
   * `acceptedById = User.id`
   * `acceptedAt = now`
   * `pendingKey = null`
6. Preserve invitation history.

After success:

* Set the accepted organization as active using the secure active-organization mechanism.
* Redirect or instruct the UI to navigate to the organization dashboard.
* Do not require the user to log out and back in.
* Do not create duplicate memberships on repeated submission.

If already accepted by the same user, return an idempotent success.

If accepted by another user or conflicting identity, return an error.

## 7. Declining an invitation

Create:

```text
POST /api/invitations/[id]/decline
```

Use the same verified-email ownership check as acceptance.

For this version, decline may set:

```text
status = REVOKED
pendingKey = null
revokedAt = now
```

If clearer, add a `DECLINED` enum value and migration instead. Prefer `DECLINED` if implementing it now because it distinguishes invitee decline from manager revocation.

If adding `DECLINED`, update all status handling consistently.

Declining must not create a User or membership unless a User profile already exists independently.

## 8. Invitation page

Create:

```text
app/invitations/page.tsx
components/invitations/invitation-list.tsx
```

This page requires Supabase authentication but must not require an existing organization membership.

Display:

```text
Organization Invitations
Review invitations sent to your verified email address
```

For each invitation show:

* Organization name
* Proposed role
* Inviter
* Expiration date
* Accept button
* Decline button

Requirements:

* Loading state
* Empty state
* Error state
* Confirmation before decline
* Display-name input if required
* Disable duplicate submissions
* Refresh after action

If no invitations and the user has no memberships, show:

```text
No active organization invitations were found for your account.
Contact the organization administrator or request a new organization.
```

Include:

* Request Access link
* Logout link

## 9. Login and callback behavior

Update login/callback routing:

After successful authentication:

1. If an active membership exists, continue to the intended application page.
2. If no active membership exists but matching invitations exist, redirect to:

   * `/invitations`
3. If no membership and no invitation exists, redirect to:

   * `/invitations`
   * Show the no-invitations guidance
4. Do not return a generic forbidden page before the user can accept an invitation.

Do not weaken protected operational routes.

Users without membership still cannot access organization data APIs.

## 10. Member-management APIs

Create:

```text
GET   /api/organization/members
PATCH /api/organization/members/[userId]
POST  /api/organization/members/[userId]/transfer-ownership
```

All routes operate only within the current active organization.

### GET members

Support:

```text
page
pageSize
search
role
status
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

Return:

* User ID
* Display name
* Email
* Organization role
* Membership active status
* Joined date
* Platform role only if genuinely needed; normally omit it

Sort:

1. OWNER
2. ADMIN
3. PLANNER
4. VIEWER
5. Display name

Return pagination metadata.

### PATCH member

Body may contain:

```json
{
  "role": "PLANNER",
  "isActive": true
}
```

Rules:

* Never accept organization ID.
* Scope membership by active organization and target user ID.
* Enforce inviter/manager permissions.
* ADMIN cannot modify OWNER or ADMIN.
* ADMIN cannot assign ADMIN or OWNER.
* OWNER cannot assign OWNER through PATCH.
* Ownership must use the dedicated transfer endpoint.
* A user cannot promote themselves.
* A user cannot deactivate themselves through the standard endpoint.
* Do not permit deactivating the only active OWNER.
* Do not modify `platformRole`.
* Preserve the User Auth account.
* Deactivation affects only this organization membership.
* Do not deactivate the global User when removing access to one organization.
* Return `404` for a membership outside the active organization.

Use simple, explicit validation.

### Ownership transfer

Only the current active OWNER can call:

```text
POST /api/organization/members/[userId]/transfer-ownership
```

Target requirements:

* Different user from current Owner
* Active User
* Active membership in the same organization
* Current role ADMIN, PLANNER, or VIEWER
* Organization active

Use a Prisma transaction:

1. Re-read current Owner membership.
2. Re-read target membership.
3. Confirm requester is still OWNER.
4. Change target role to OWNER.
5. Change current Owner role to ADMIN.
6. Confirm the organization retains one active OWNER.

Return both updated memberships.

Prevent concurrent transfers from leaving zero or multiple unintended Owners. Use an appropriate transaction isolation level or conditional update strategy supported by the installed Prisma version.

Do not implement ownership transfer by sequential unrelated updates outside a transaction.

## 11. Invitation-management APIs

Create:

```text
GET  /api/organization/invitations
POST /api/organization/invitations/[id]/revoke
POST /api/organization/invitations/[id]/resend
```

All are scoped to the active organization.

### GET invitations

Support:

```text
page
pageSize
search
status
role
```

Return newest first.

Include:

* Email
* Display name
* Role
* Status
* Delivery status
* Inviter
* Sent date
* Expiration
* Accepted date
* Safe delivery error only for authorized managers

### Revoke

Rules:

* Invitation belongs to active organization.
* Invitation is PENDING.
* Requester has permission for the invited role.
* Set:

  * `status = REVOKED`
  * `revokedAt = now`
  * `pendingKey = null`
* Do not delete invitation history.
* Do not delete an Auth user.
* Do not remove an already accepted membership.

### Resend

Rules:

* Invitation belongs to active organization.
* Invitation remains PENDING.
* Invitation has not been revoked or accepted.
* Requester has permission for the invited role.
* If expired:

  * Either create a replacement invitation safely, or
  * Extend expiration and restore PENDING with `pendingKey`
* Prevent resend abuse with a minimum interval, such as 60 seconds.
* Use Supabase Admin only on the server.
* Update delivery status and sent date.
* Existing-account behavior remains safe.
* Do not create duplicate invitations.
* Do not expose raw provider errors.

## 12. Member-management UI

Create:

```text
app/settings/members/page.tsx
components/settings/member-manager.tsx
```

Add navigation:

```text
Settings
- Members
```

Show only to OWNER and ADMIN where practical.

API authorization remains mandatory.

Use tabs or clearly separated sections:

```text
Members
Invitations
```

### Members section

Display:

* Name
* Email
* Role
* Status
* Joined date
* Actions

Filters:

* Search
* Role
* Status
* Clear filters

Actions based on permission:

* Change role
* Activate
* Deactivate
* Transfer ownership

Use a drawer or modal for role changes.

Require confirmation for:

* Deactivation
* Ownership transfer

Ownership transfer confirmation must clearly state:

```text
You will become an Admin and the selected member will become the Organization Owner.
```

### Invitations section

Display:

* Email
* Display name
* Role
* Status
* Delivery status
* Invited by
* Expiration
* Actions

Actions:

* Invite member
* Resend
* Revoke

Invite form:

* Email
* Display name, optional
* Role

Only show roles the current manager can assign.

Show clear delivery results:

* Invitation email sent
* Existing account can accept after signing in
* Delivery failed; retry available

Do not expose sensitive provider errors.

## 13. Organization switcher behavior

After invitation acceptance:

* New membership appears in available organizations.
* Accepted organization becomes active.
* Data from the previously active organization is cleared/refetched.
* The user cannot access other organizations without membership.
* Deactivated memberships disappear from the switcher.
* If current membership is deactivated, select another valid membership or deny organization access safely.

Do not trust organization IDs from browser state without server validation.

## 14. Security rules

* Never store passwords.
* Never store Supabase invitation tokens.
* Never expose Supabase secret/service keys.
* Never trust invitation email from the browser.
* Use the verified Auth email.
* Never trust organization or role values without server authorization.
* Invitation acceptance must be one-time and idempotent.
* Cross-organization invitation IDs must return `404`.
* Do not reveal another organization’s members.
* Do not allow role escalation through PATCH.
* Do not allow Admin to create Admin or Owner.
* Do not allow direct Owner assignment.
* Preserve at least one active Owner.
* Never change platform role through organization APIs.
* Never delete Auth users when removing organization membership.
* Avoid account enumeration in public responses.
* Do not log Auth tokens, cookies, or secret keys.

## 15. Manual verification

Test with:

```text
Organization A Owner
Organization A Admin
Organization A Planner
Organization A Viewer
Existing authenticated user with no membership
New email with no Auth account
Organization B Owner
```

Verify:

1. Owner can invite Admin, Planner, and Viewer.
2. Owner cannot invite Owner.
3. Admin can invite Planner and Viewer.
4. Admin cannot invite Admin or Owner.
5. Planner and Viewer cannot invite.
6. New email receives Supabase invitation.
7. New invited user can authenticate and see `/invitations`.
8. New user can accept and receives correct membership.
9. Existing Auth user sees invitation after login.
10. Acceptance email must match verified Auth email.
11. Duplicate pending invitation is prevented.
12. Expired invitation cannot be accepted.
13. Revoked invitation cannot be accepted.
14. Repeated acceptance does not create duplicate membership.
15. Admin cannot modify Owner or Admin.
16. Owner can change non-Owner roles.
17. No user can promote themselves.
18. Standard PATCH cannot assign OWNER.
19. Ownership transfer changes target to OWNER and current Owner to ADMIN.
20. Organization never has zero active Owners.
21. Deactivating membership does not delete User or Auth account.
22. Organization A cannot see or modify Organization B members or invitations.
23. Accepted organization becomes active.
24. Secret key never appears in browser code or Network requests.
25. Build and lint pass.

## 16. Verification commands

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

* Prompt 3 is incomplete.
* Authenticated users without memberships cannot reach invitation acceptance.
* Supabase Admin client is unsafe.
* Migration history is unhealthy.
* Email identity cannot be verified.
* Existing User email conflicts with another Auth UUID.
* Ownership transfer cannot be made transactional.
* Completion requires database reset.
* Cross-organization access cannot be prevented.
* A secret appears in client code.

## Final report

Report:

* Prisma model and migration
* Environment changes
* Invitation APIs
* Acceptance behavior
* Existing-user behavior
* New-user behavior
* Member-management APIs
* Role rules
* Ownership-transfer rules
* UI pages and components
* Organization-switcher updates
* Security checks
* Manual test results
* Prisma validation result
* Migration status
* Lint result
* Build result
* Remaining pre-existing warnings
* Manual setup still required

Clearly state:

```text
Prompt 4 complete
```

Then stop. Do not begin Audit Log.
