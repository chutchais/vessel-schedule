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
