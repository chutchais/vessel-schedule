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
