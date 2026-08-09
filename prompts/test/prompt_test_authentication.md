Implement E2E Batch 1: authentication, roles and organization isolation.

Read AGENTS.md if present. Inspect the existing authentication, first-time setup,
organization requests, invitation flow, memberships, active-organization switching and
test infrastructure. Read relevant handoff/release-checklist sections only when needed.

Safety:

- Never run E2E tests against production.
- Require an explicit test environment and test database.
- Refuse known production Supabase URLs, database hosts and APP_URL values.
- Display only sanitized targets.
- Use synthetic accounts and organizations.
- Never print passwords, service-role keys, session tokens or invitation tokens.
- Do not send real email; use the existing fake/memory email transport.
- Reset or delete only records created by the E2E suite.

Use Playwright if no E2E framework already exists. Report the test architecture and target
guards before editing.

Test roles:

- Platform Super Admin
- Organization Owner
- Organization Admin
- Organization Member
- Invited new user
- User belonging to a second organization
- Signed-out visitor

Required workflows:

1. First-time setup
   - Empty application data shows setup page.
   - First Platform Admin can be created once.
   - Setup cannot be repeated.
   - Non-empty/initialized systems cannot access setup.

2. Authentication
   - Valid sign-in and sign-out
   - Invalid credentials
   - Protected-route redirect
   - Disabled/inactive user behavior
   - Session persistence and expiration handling where testable
   - Safe return URL without open redirects

3. Organization request
   - Guest submits Request Access.
   - Platform Admin can view and approve it.
   - Non-Platform-Admin cannot approve it.
   - Repeated/concurrent approval does not create duplicate organizations or owners.
   - Rejected/approved requests cannot transition incorrectly.

4. Invitation onboarding
   - Owner/Admin creates invitation.
   - New invited user creates an account using the locked invited email.
   - Existing user signs in and accepts.
   - Wrong-email account cannot accept.
   - Expired, revoked, replaced and reused tokens fail.
   - Acceptance creates exactly one membership.
   - Accepted organization becomes active.
   - Raw invitation tokens are not logged or persisted.

5. Role permissions
   - Owner can manage Admin/Member and transfer ownership according to policy.
   - Admin can manage allowed members but cannot assign Owner or Platform Admin.
   - Member cannot manage membership or organization settings.
   - No organization role can grant Platform Super Admin.
   - Users cannot modify their own protected role incorrectly.

6. Organization isolation
   Create Organization A and Organization B with representative records.

   Verify users from A cannot read, create, update or delete B’s:
   - Companies
   - Ports
   - Terminals
   - Berths
   - Vessels
   - Services
   - Schedules
   - Memberships
   - Invitations
   - Audit logs
   - Planner data and change events
   - Export data

   Test direct navigation, API requests and guessed foreign record IDs.
   Hidden UI controls alone are not proof of authorization.

7. Active organization
   - User with multiple memberships can switch organization.
   - Active organization persists safely.
   - Forged/foreign organization cookies are rejected.
   - Switching organization does not retain inaccessible selection or cached data.

Testing requirements:

- Combine browser E2E tests with database-backed API/integration tests where browser tests
  cannot prove concurrency or row isolation.
- Use deterministic setup and cleanup.
- Capture screenshots/traces only on failure.
- Redact secrets from artifacts.
- Avoid fixed sleeps; wait for observable UI/network/database states.
- Make tests independently repeatable.
- Add documented commands for headless and interactive execution.

Run type-check, lint, all unit/integration/E2E tests and production build. Fix only issues
within authentication, authorization and organization isolation.

Update PROJECT_HANDOFF.md, CHANGELOG.md and MVP_RELEASE_CHECKLIST.md with concise results.
Report passed/failed scenarios, unresolved blockers and an E2E Batch 1 GO/NO-GO result.

Do not commit, push, deploy, access production, configure real email or change the deferred
hosted-staging status.