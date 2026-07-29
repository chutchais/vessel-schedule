Implement transactional email delivery for organization invitations and complete invitation onboarding.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect authentication, invitation creation, invitation-only registration, email verification, environment configuration and audit logging. Briefly report the plan before editing.

Requirements:

1. Email abstraction
   - Create a small server-only email service abstraction.
   - Support SMTP through environment configuration.
   - Do not couple invitation business logic directly to one provider.
   - Never expose SMTP credentials to client code.
   - Provide a safe development mode that logs only the recipient, subject and message type—not tokens or passwords.
   - Do not silently report success when delivery fails.

2. Invitation email
   - Send an email after an Owner/Admin creates or replaces an invitation.
   - Include:
     - Organization name
     - Inviter name
     - Assigned role
     - Expiration date
     - Secure invitation acceptance link
   - Use the trusted APP_URL for links.
   - Never store or log the raw invitation token.
   - A replacement invitation must invalidate the previous link.
   - Add Resend Invitation for active invitations by generating a new token/link, not recovering the old token.
   - Rate-limit sending and prevent duplicate rapid requests.

3. Email confirmation
   - New invitation-only accounts must verify control of the invited email.
   - If the invitation link itself is treated as email ownership verification, document and enforce that security model consistently.
   - Otherwise send a separate single-use email-verification token.
   - Do not create duplicate verification flows unnecessarily.
   - Existing verified users should not need to verify the same email again.
   - Invalid, expired, revoked, replaced or accepted invitations must not verify an account.

4. Delivery state
   - Track safe delivery metadata such as pending, sent or failed, attempt time and failure category.
   - Do not store sensitive provider responses or raw tokens.
   - Show delivery status in Pending Invitations.
   - Allow authorized Owner/Admin users to retry failed delivery.
   - Make invitation creation behavior explicit if email fails: keep the valid copyable link available once and show that email delivery failed.

5. Security
   - Scope all actions to the active organization.
   - Enforce Owner/Admin permissions server-side.
   - Prevent role escalation and Platform Admin invitations.
   - Normalize and validate email addresses.
   - Escape all user-controlled values in HTML email templates.
   - Do not reveal whether unrelated email addresses have accounts.
   - Audit invitation send, resend, failure and acceptance without recording tokens.

6. Configuration
   - Document required variables, for example:
     SMTP_HOST
     SMTP_PORT
     SMTP_SECURE
     SMTP_USER
     SMTP_PASSWORD
     EMAIL_FROM
     APP_URL
   - Validate required production configuration at startup or before sending.
   - Keep secrets out of source control and example values non-sensitive.

7. Testing
   - Use a fake email transport in automated tests.
   - Test successful delivery, provider failure, retry, rate limiting, replacement-link invalidation, HTML escaping, organization isolation and verification behavior.
   - Verify invitation acceptance for both new and existing users.
   - Do not require a real mail server for automated tests.

Run Prisma validation and create a reviewed migration if delivery metadata requires schema changes. Run type-check, lint, relevant tests and production build. Update .env.example, PROJECT_HANDOFF.md and CHANGELOG.md. Report configuration steps, changed files, migration details and verification results. Do not commit or push.