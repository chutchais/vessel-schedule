Implement secure organization invitation links with a copyable URL.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect the current authentication, User, Organization, Membership, roles and organization-management pages. Briefly report the plan and any required Prisma migration before editing.

Requirements:

- Organization Owner/Admin can open Organization Settings → Members and create an invitation.
- Invitation form requires email address and organization role.
- Generate a cryptographically secure, single-use random token server-side.
- Store only a SHA-256 hash of the token in the database.
- Never store or log the raw token.
- Include organizationId, normalized email, role, createdById, createdAt and expiresAt.
- Support acceptedAt and revokedAt.
- Use a sensible expiration such as seven days.
- Prevent or safely replace duplicate active invitations for the same organization and email.
- Return the raw token only once after creation.
- Construct the invitation URL using a trusted APP_URL environment variable, not an untrusted request Host header.
- Display the generated URL in a read-only field with a “Copy link” button.
- Show clear copied, error and clipboard-unavailable states.
- Allow Owner/Admin to list pending invitations, revoke them and generate a replacement link.
- Never display an old raw token from the database.

Acceptance flow:

- Add /invitations/accept?token=... page.
- If signed out, preserve the token through sign-in or registration and return to the acceptance page.
- Validate the token by hashing it and finding the matching invitation.
- Reject invalid, expired, revoked or already-used invitations.
- Require the signed-in user’s normalized email to match the invited email.
- On acceptance, create the membership transactionally and mark the invitation accepted.
- If membership already exists, finish safely without creating a duplicate.
- Prevent token reuse and race-condition double acceptance.
- Redirect to the accepted organization after success.

Security:

- Derive the inviter’s organization and permissions server-side.
- Only Owner/Admin may invite, revoke or replace invitations.
- Do not trust organizationId or role without server-side validation.
- Enforce allowed role assignment; an Admin must not grant a role above their authority.
- Never allow invitations to create a Platform Admin.
- Rate-limit invitation creation and acceptance attempts using existing project conventions.
- Record invitation creation, revocation, replacement and acceptance in the audit log without recording tokens.
- Do not reveal sensitive account-existence information.

Add tests for permissions, organization isolation, token hashing, copying, expiration, revocation, replacement, email mismatch, successful acceptance, duplicate membership, token reuse and concurrent acceptance.

Run Prisma validation and create a migration if required. Run type-check, lint, relevant tests and production build if practical. Fix introduced issues. Update PROJECT_HANDOFF.md, CHANGELOG.md and environment documentation for APP_URL. Report changed files, migration details and verification results. Do not commit or push.