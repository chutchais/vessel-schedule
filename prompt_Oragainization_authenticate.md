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
