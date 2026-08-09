Implement secure, expiring, read-only Berth Planner share links.

Read AGENTS.md if present. Inspect the current planner API, organization authorization,
planner labels, filters, middleware, audit log and token-hashing patterns. Read relevant
release-checklist sections only when necessary.

Before editing, report:

1. Proposed share-link flow
2. Public data allowlist
3. Token/session security design
4. Prisma migration required
5. Rate-limiting design
6. Tests required

Wait for approval before creating a migration.

Feature flag:

Add:

PUBLIC_PLANNER_SHARING_ENABLED=false

- Sharing must be disabled by default.
- When disabled, creation APIs and public pages return a safe unavailable response.
- Do not expose the flag as a client-controlled authorization decision.

Share creation:

Organization Owner/Admin can create a link for:

- One organization derived server-side
- One selected terminal
- A fixed start and end date
- Maximum range of 31 days
- Optional validated planner filters
- Initial Position or Datetime view
- Expiration of 15, 20 or 30 days

Requirements:

- Verify terminal ownership server-side.
- Calculate dates using the port timezone.
- Store createdById, createdAt, expiresAt, revokedAt and optional lastAccessedAt.
- Owner/Admin can list and revoke links.
- Members cannot create, list or revoke public shares.
- Audit create and revoke operations without recording secrets.
- Show the copyable raw link only once.
- An old raw link cannot be reconstructed from the database.
- If lost, the user creates a new link.

Token security:

Prefer this design:

- Generate a public non-secret share ID.
- Generate at least 32 random bytes for the secret.
- Store only SHA-256(secret).
- Link format:
  /shared/berth-planner/{publicId}#{secret}
- The URL fragment must not be sent automatically to the server.
- The public page exchanges the fragment secret through a POST endpoint.
- On success, set a short-lived Secure, HttpOnly, SameSite=Lax share-session cookie.
- Scope the cookie as narrowly as practical.
- Session expiry must never exceed link expiry.
- Remove the secret fragment from the browser address bar after successful exchange.
- Revalidate share status, expiry, organization and terminal on every data request.
- Revocation must invalidate existing share sessions immediately.

If the current architecture cannot safely support fragment exchange, stop and explain the
alternative before implementing a raw token in the URL.

Never:

- Store or log the raw secret
- Put the secret in audit logs, analytics or error reports
- Return token hashes
- Use predictable IDs as authentication
- Treat possession of publicId alone as access
- Use an authenticated planner API from the public page

Public planner:

- Add a dedicated minimal public page without the application sidebar.
- Show only the shared terminal and allowed date range.
- Permit Position/Datetime switching.
- Allow navigation only within the fixed shared range.
- Render the live current planner data, not a stale snapshot.
- No create, edit, drag, resize, undo or status changes.
- No links into authenticated schedule, audit or administration pages.
- No CSV/PDF export in this task.
- No Recent Changes, user names or audit information.
- No organization membership data or internal record IDs.
- Keep the page usable on desktop and tablet.

Public data allowlist:

Allow only fields required to display:

- Organization display name, if approved
- Port and terminal names
- Port timezone
- Berth name, length, order, color and zeroOriginSide
- Vessel name and LOA
- Voyage number
- Service name and safe display color
- ETA, ETB and ETD
- Berth position
- Heading
- Schedule status

Do not expose:

- Remarks
- updatedAt
- Audit metadata
- Creator/editor identity
- Internal IDs in rendered output
- Invitation or membership data
- Unused schedule fields

Internal IDs may be used as opaque implementation keys in the bounded API response only
when necessary, but must not permit direct internal API navigation.

External vessel labels:

- Do not automatically use the full internal organization label template.
- Create a fixed external-safe default template using only approved public placeholders.
- Remove/reject disallowed placeholders such as remarks and updatedAt.
- Reuse the shared placeholder parser and formatters.
- Do not duplicate calculation or timezone logic.
- Do not support HTML, CSS, JavaScript or arbitrary expressions.

Public API security:

- Build dedicated public share-session and planner-data endpoints.
- Query schedules only through the validated share’s organization, terminal and date range.
- Never accept organizationId as authorization.
- Bound date range, filters and response size.
- Return the same generic response for invalid, expired, revoked and unknown links.
- Add durable rate limiting to secret exchange and public data requests.
- Do not use a process-local Map for production rate limiting.
- Handle proxy/IP information only through trusted deployment configuration.
- Use generic 404/410 behavior without leaking organization existence.
- Add Cache-Control: private, no-store.
- Add Referrer-Policy: no-referrer.
- Add X-Robots-Tag or page metadata: noindex, nofollow.
- Ensure CSP and other security headers still