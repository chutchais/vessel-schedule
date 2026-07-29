# MVP Release Readiness and Security Audit

Audit date: 2026-07-29  
Scope: Step 1 of `prompts/prompt_mvp_production_plan`  
Recommendation: **GO WITH TIME-LIMITED RB-4 EXCEPTION**

The application builds and all 131 tests pass, and the reviewed operational APIs consistently derive the active organization from the authenticated server-side user context. RB-1 through RB-3 are technically resolved. RB-4's remaining Next.js/PostCSS vulnerabilities are not technically resolved; they are covered by an explicitly approved exception expiring 2026-08-28. Read-only verification of the database incident found consistent migration history and schema, so that incident no longer blocks release.

RB-4 changed dependency manifests and generated Prisma Client only. It did not change product, authentication, authorization, schema, migration, or public behavior.

## Release blockers

### RB-1 — Invitation acceptance can race decline or revoke

- Classification: **RESOLVED (formerly RELEASE BLOCKER)**
- Resolution status (2026-07-29): database-backed PostgreSQL concurrency suite passes.
- Affected code:
  - `app/api/invitations/[id]/decline/route.ts:24-52`
  - `app/api/organization/invitations/[id]/revoke/route.ts:21-56`
  - Compare the safe conditional claim in `app/api/invitations/accept/route.ts:41-43`.
- Evidence/reproduction: decline and revoke check `PENDING` before their transaction, then update by `id` without including `status`, `acceptedAt`, `revokedAt`, or `expiresAt` in the write predicate. Pause either request after its initial read, accept the same token, then resume it. The later update can produce `DECLINED`/`REVOKED` with `acceptedAt` still populated and an already-created membership.
- Impact: contradictory invitation/audit state; an administrator can believe an accepted membership was revoked when it was not. One-time-use onboarding invariants are not reliable under concurrency.
- Smallest safe remediation: inside each transaction, claim with `updateMany` constrained to the organization/id, `status: PENDING`, null acceptance/revocation timestamps, and unexpired `expiresAt`; require `count === 1`. Build audit data only from the successfully claimed row.
- Tests: database-backed concurrent accept-vs-decline and accept-vs-revoke tests; assert exactly one terminal transition, consistent timestamps, one membership at most, and matching audit history.
- Implemented:
  - `lib/auth/invitation-transitions.ts` centralizes ACCEPTED, DECLINED, and REVOKED transaction boundaries. Each terminal transition uses a conditional claim, requires one affected row, reloads the claimed record, and writes its audit event in the same transaction.
  - Losing accept/decline/revoke requests return a domain conflict that route handlers expose as HTTP 409 without audit or membership side effects.
  - Acceptance now creates the application user before assigning the `acceptedById` foreign key; a losing claim throws a rollback sentinel, so the provisional user write is rolled back.
  - DECLINED no longer writes `revokedAt`; enum status is authoritative for invitation history. No schema change was required because no `declinedAt` field exists.
  - Replacement retains its conditional old-row claim, reloads the claimed row inside the transaction, creates a fresh row/token, and returns 409 when another terminal transition wins.
- Verification evidence:
  - `lib/auth/invitation-transitions.integration.test.ts` ran against a disposable PostgreSQL 17 database with the real migration history.
  - 10/10 RB-1 database scenarios passed: accept/decline, accept/revoke, two accepts, two declines, two revokes, expired rejection, already-accepted rejection, accept-after-revoke/decline, organization isolation, permissions, membership cardinality, and audit consistency.
  - Full suite passed 95/95; Prisma validation, TypeScript, lint, production build, and `git diff --check` passed.

### RB-2 — Schedule placement and conflict policy can be bypassed server-side

- Classification: **RESOLVED (formerly RELEASE BLOCKER)**
- Resolution status (2026-07-29): real PostgreSQL geometry, synchronized concurrency and stale-write tests pass.
- Affected code:
  - `app/api/schedules/route.ts:323-430`
  - `app/api/schedules/[id]/route.ts:487-608`
  - `prisma/schema.prisma:431-502`
- Evidence/reproduction:
  - POST/PATCH accepts any integer `berthPositionMeters`; the berth query does not select `berthLength`, and no server check rejects a negative position or `position + vessel LOA > berthLength`.
  - Conflict detection runs before the create/update transaction. Two simultaneous requests for the same berth/time/position can both observe no conflict and both commit.
  - Ordinary edit PATCHes do not require `expectedUpdatedAt`; only planner move/resize paths do, so concurrent form edits are last-write-wins.
- Impact: invalid vessel geometry, overlapping bookings despite the advertised rejection policy, and silent loss of concurrent edits in the core workflow.
- Smallest safe remediation: validate non-negative placement and vessel fit using server-loaded berth length/LOA; serialize conflict check plus write (for example with a transaction-scoped advisory lock per berth) and apply optimistic concurrency to every schedule update.
- Tests: API/database tests for negative/out-of-range placement, missing geometry policy, two concurrent conflicting creates/updates, and stale ordinary edits, moves, resizes, and undo.
- Implemented:
  - `lib/schedules/schedule-mutations.ts` is the authoritative server mutation domain for create, ordinary edit/status update, planner move, resize and undo.
  - Physical occupancy is `[ETB ?? ETA, ETD)` × `[berthPositionMeters, berthPositionMeters + vessel LOA)`. All statuses except CANCELLED participate; both axes use strict overlap, so touching endpoints are allowed.
  - Incomplete schedules remain supported, but only as non-physical records: berth and/or position may be null, while a non-null position requires a selected active same-organization berth, positive vessel LOA, positive berth length, non-negative position and complete fit.
  - Geometry uses transaction-reloaded organization-scoped Vessel, Terminal, Berth and Service records. `zeroOriginSide` and `headingReverse` do not alter the local metre interval.
  - Every physical create/update acquires PostgreSQL transaction-scoped advisory locks derived from organization plus berth. Moves lock old and new berths in sorted order. Conflict candidates are queried only after the locks and on the same transaction/connection.
  - Transactions use bounded Prisma wait/runtime and a PostgreSQL lock timeout. Lock timeout/deadlock failures return a safe retryable conflict without write/audit effects.
  - Every PATCH requires `expectedUpdatedAt`. Schedule writes use `updateMany` constrained by schedule ID, organization and exact timestamp, requiring one affected row.
  - Undo compares the client version, schedule version and undo version; its single-use claim, schedule restoration, conflict check and audit share one transaction. A rollback leaves the undo token unused.
  - Schedule forms, planner drawer, move, resize and undo clients now send the loaded version. Stale responses preserve input and refresh authoritative planner/list data.
- Verification evidence:
  - `lib/schedules/schedule-mutations.integration.test.ts` ran against disposable PostgreSQL 17 with the complete migration history.
  - 14/14 database scenarios passed: geometry boundaries/incomplete policy, tenant isolation, synchronized create/create, update/update and create/update races, opposite-berth lock ordering, strict endpoint semantics, cancelled behavior, ordinary/status/move/resize stale writes, audit cardinality and stale/conflicting undo rollback.
  - `lib/schedules/schedule-route-contract.test.ts` verifies every PATCH caller and route requires the explicit version.
  - Full suite passed 126/126 with RB-1, RB-2 and RB-3 database suites enabled.
  - No schema change or migration was required.

### RB-3 — Organization-request approval is not atomically claimed

- Classification: **RESOLVED (formerly RELEASE BLOCKER)**
- Resolution status (2026-07-29): real PostgreSQL concurrent approval and failure/retry tests pass.
- Affected code: `app/api/admin/organization-requests/[id]/approve/route.ts:85-149`
- Evidence/reproduction: two administrators can both read `PENDING`, both unconditionally set `APPROVING`, and both continue using the stale object whose `organizationId` is null. Each may create an organization and trigger an auth invitation before the request is linked.
- Impact: duplicate organizations, duplicate external invitations, orphaned organization data, and ambiguous ownership/audit history.
- Smallest safe remediation: atomically claim the request with a conditional update (`PENDING`/approved retry state to `APPROVING`) and require one affected row before any external side effect. Define an idempotent retry/recovery state machine.
- Tests: concurrent approval integration test, failure/retry at each external-side-effect boundary, and assertion that exactly one organization/owner/invitation is produced.
- Implemented:
  - `lib/admin/organization-request-approval.ts` owns the approval state machine. Initial and retry claims use `updateMany` constrained by request ID, eligible status, current `organizationId`, approval version and recovery timestamp; only `count === 1` proceeds.
  - The claim is reloaded and audited transactionally. Losing concurrent requests return HTTP 409 and cannot create organizations, identities, memberships or audit events.
  - Organization creation and request linking share a database transaction and commit before the Supabase network call. The linked organization is reused on every retry.
  - Durable claim ID, version, timestamp and progress stage distinguish fresh work, recoverable failures and abandoned `APPROVING` attempts. `APPROVED`, `REJECTED` and `CANCELLED` are terminal.
  - Supabase invitation/account work is behind an adapter. Confirmed Auth identity IDs are persisted before local owner finalization; an already-existing provider identity is resolved by normalized email and reused. No provider response, token or credential is stored or audited.
  - Local user, OWNER membership, final `APPROVED` transition and success audit commit together. Recoverable failures become `APPROVAL_FAILED` with a safe category and matching audit; they never reset to `PENDING`.
  - Rejection now conditionally claims only an unlinked `PENDING` request, preventing approval/rejection overwrite races.
- Migration:
  - `20260729213000_add_organization_approval_progress` adds `approvalClaimId`, `approvalClaimedAt`, `approvalVersion`, and the `OrganizationApprovalStage` progress enum.
- Verification evidence:
  - `lib/admin/organization-request-approval.integration.test.ts` ran against disposable PostgreSQL 17 with the complete migration history and a deterministic fake Supabase/email adapter.
  - 16/16 RB-3 scenarios passed, including concurrent administrators, repeated approvals, all nine required failure boundaries, provider failure/already-existing identity, terminal states, abandoned `APPROVING` recovery, authorization and same-data request isolation.
  - Full suite passed 111/111 with both RB-1 and RB-3 real-database suites enabled.

### RB-4 — Installed dependencies have known high-severity vulnerabilities

- Classification: **OPEN VULNERABILITIES — APPROVED TIME-LIMITED EXCEPTION (formerly RELEASE BLOCKER)**
- Remediation status (2026-07-30): Prisma findings are technically resolved and Sharp is excluded from the final production artifact. The PostCSS vulnerabilities remain technically unresolved. The authorized approver explicitly accepted only Next.js 16.2.12's transitive PostCSS 8.4.31 and advisories `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, and `GHSA-r28c-9q8g-f849`, subject to the controls and 2026-08-28 hard expiry below.
- Affected code: `package.json`, `package-lock.json`
- Before/after audit evidence:
  - Before: full audit 16 (15 high, 1 moderate); npm's `--omit=dev` audit 7 (6 high, 1 moderate).
  - After Prisma 7.9.1: full audit 12 high; normal `--omit=dev` audit 3 high.
  - Clean `npm ci --omit=dev --omit=optional`: 49 installed packages; Sharp, Prisma CLI and ESLint are absent. Its audit reports only the Next/PostCSS path as two findings (1 high, 1 moderate).
- Resolved by compatible upgrade:
  - Direct `prisma`, `@prisma/client`, and `@prisma/adapter-pg` were upgraded together from 7.9.0 to exact 7.9.1.
  - Lockfile transitives now include `@prisma/dev@0.24.17`, `find-my-way@9.7.0`, and `valibot@1.4.2`; the Prisma CLI advisories are resolved.
- Excluded from the production artifact:
  - Next 16.2.12 declares optional `sharp@^0.34.5`, resolved as vulnerable 0.34.5 in a normal production install. A clean no-optional tree excludes it.
  - The application contains no `next/image` import, image optimizer configuration, remote-image configuration, image processing/upload path, or untrusted image input. Planner weekly PDF export renders existing HTML in the browser and does not use Sharp.
  - A disposable build succeeded while `node_modules/sharp` was absent and Next's exact supported Linux SWC 16.2.12 binary was present. After `npm prune --omit=dev --omit=optional`, the production server started; `/`, `/login`, the protected `/berth-planner` redirect, bundled fonts/CSS/JavaScript, and a public SVG passed.
  - Required artifact process: build in a clean build stage, then run `npm prune --omit=dev --omit=optional` before copying the runtime tree. Also verify the resulting tree with `npm ls --omit=dev sharp eslint prisma` and fail deployment if any is installed. Building directly after omitting all optional packages is not supported by this project's default Turbopack command because that also removes Next's native SWC binary.
  - Sharp advisory `GHSA-f88m-g3jw-g9cj` (high), affecting 0.34.5 and patched in 0.35.0, is therefore **EXCLUDED from the production artifact**, conditional on the exact pruning control. Adding `next/image`, uploads/image processing, changing the install command, or finding Sharp in the artifact immediately reopens RB-4.
- Development/build-tool risk:
  - ESLint 9.39.5's `brace-expansion` path (`GHSA-mh99-v99m-4gvg`, high) is absent from both clean production trees. npm proposes ESLint 10.8.0, an unreviewed major; it was rejected for this task. Keep CI/build inputs trusted and upgrade in a separate compatibility review.
- Temporary PostCSS exception — **APPROVED 2026-07-29**:
  - Advisories: `GHSA-qx2v-qp2m-jg93` (moderate), `GHSA-6g55-p6wh-862q` (high), and `GHSA-r28c-9q8g-f849` (moderate), affecting Next's `postcss@8.4.31`; the complete fix level is PostCSS 8.5.18.
  - Why currently unreachable: repository search found no runtime PostCSS API usage, CSS upload/editor endpoint, or user-controlled CSS/source-map input. PostCSS processes repository-controlled styles during trusted builds only.
  - Approval scope: Next.js 16.2.12's transitive PostCSS 8.4.31 only, covering only `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, and `GHSA-r28c-9q8g-f849`.
  - Production controls: immutable reviewed source build; no user-controlled CSS or source-map processing; no runtime CSS compilation; no CSS upload route; no arbitrary source-map inputs; Sharp excluded from the production artifact; dependency tree verification during artifact creation.
  - Detection/monitoring: fail CI on new PostCSS imports or CSS/upload processing routes; run both npm audits on every lockfile change and at least weekly; monitor stable Next releases and the three advisories.
  - Expiration: **2026-08-28 at the latest**. Owner: Engineering Lead/dependency owner. Deployment must stop and RB-4 reopens automatically if the exception is not renewed or the dependency is not upgraded before expiry.
  - Immediate reopen triggers: any untrusted CSS/source-map feature, build input becoming user-controlled, dependency/artifact control drift, a stable Next release with patched PostCSS, or new exploit evidence.
  - Upgrade/retest: move to the first supported stable Next release declaring PostCSS >=8.5.18; rerun clean installs, both audits, Prisma generate/validate, TypeScript, lint, all PostgreSQL suites, build, production startup and core smoke tests.
  - No override was added: stable Next 16.2.12 pins PostCSS exactly to 8.4.31. Replacing an exact framework pin requires separate explicit approval and upstream compatibility evidence.
- Automated enforcement:
  - `.github/workflows/rb4-exception-controls.yml` runs on relevant source/lockfile changes, pull requests, manual dispatch, and every Monday.
  - `scripts/verify-rb4-runtime.mjs` fails if the date is after 2026-08-28; Next/PostCSS or advisory scope changes; Sharp, Prisma CLI, or ESLint appears in the runtime tree; runtime PostCSS imports or CSS processing routes appear; or npm reports any advisory outside the exact allowlist.
  - The workflow builds first, runs `npm prune --omit=dev --omit=optional`, verifies the pruned artifact, then starts it and smoke-tests root, login, the protected planner route, and a bundled static asset.
- Unsupported options rejected: `npm audit fix --force` and its Next 9.3.3 downgrade; Sharp 0.35 forced outside stable Next's declared range; a PostCSS override over an exact framework pin; ESLint 10; preview/canary Next releases.

## Important findings

### I-1 — Rate limiting is incomplete and not durable

- Classification: **IMPORTANT**
- Affected code:
  - `lib/auth/invitation-rate-limit.ts:1-17`
  - `app/api/organization-requests/route.ts:77-118`
  - `app/(auth)/login/page.tsx:15-29`
  - `app/(auth)/forgot-password/page.tsx:12-24`
- Evidence: invitation limiting is a process-local `Map`, so it resets on restart and is not shared across serverless instances. The public access-request endpoint has only a honeypot/deduplication check. Login and reset rely entirely on unverified Supabase project settings.
- Impact: abuse, email bombing, credential stuffing, and request-table flooding remain possible.
- Smallest safe remediation: use a durable shared limiter/CAPTCHA and document/verify Supabase auth rate-limit settings.
- Tests: distributed limiter tests, proxy-header handling tests, and endpoint 429/recovery tests.

### I-2 — Production environment configuration is not validated centrally

- Classification: **IMPORTANT**
- Affected code: `lib/db/prisma.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts`, `lib/supabase/admin.ts`, `lib/auth/invitation-links.ts`, `lib/email/invitation-email.ts`, `.env.example`
- Evidence: most variables use scattered non-null assertions or validation at first use. `APP_URL` and `NEXT_PUBLIC_APP_URL` are separate authorities; password reset uses `window.location.origin`, while invitations use `APP_URL`.
- Impact: a deployment can build/start with missing or inconsistent settings and fail only on a user path; redirect allowlists and HTTPS assumptions may drift.
- Smallest safe remediation: add server-start/build validation for required production variables and one canonical trusted application origin; document Supabase redirect allowlist and session/password policy.
- Tests: configuration matrix covering missing values, HTTP production URLs, malformed SMTP values, and mismatched origins.

### I-3 — Security response headers are not configured

- Classification: **IMPORTANT**
- Affected code: `next.config.ts:3-5`
- Evidence: no application headers are defined for CSP, frame embedding, referrer policy, MIME sniffing, or browser permissions.
- Impact: reduced defense in depth against XSS, clickjacking, content-type confusion, and data leakage.
- Smallest safe remediation: add a tested production header policy, starting with CSP in report-only mode if necessary, plus `frame-ancestors`, `nosniff`, a restrictive referrer policy, and permissions policy.
- Tests: production response-header assertions and CSP violation review.

### I-4 — Tenant/auth/concurrency behavior lacks route-level automated tests

- Classification: **IMPORTANT**
- Affected code: current `*.test.ts` suite; `docs/isolation-test-plan.md`
- Evidence: all 18 tests are pure/unit-oriented; there are no database-backed API tests proving cross-organization denial, role matrices, auth route protection, invitation races, or mutation concurrency.
- Impact: the most security-sensitive guarantees can regress while the suite remains green.
- Smallest safe remediation: implement the isolation plan against an isolated test database with two organizations and every role.
- Tests: the remediation is the missing suite; include every GET/mutation and guessed foreign IDs.

### I-5 — Database constraints do not encode all tenant relationships

- Classification: **IMPORTANT** (carry into Step 2)
- Affected code: `prisma/schema.prisma:280-502`
- Evidence: related operational records have independent `organizationId` columns, while foreign keys generally reference only record `id`; the database itself cannot prevent a terminal from referencing another tenant's port, a service another tenant's company, or a schedule foreign-tenant vessel/terminal/berth/service. Application routes currently validate these relations.
- Impact: future code, scripts, imports, or data repair can create cross-tenant relational corruption even if current routes are scoped.
- Smallest safe remediation: evaluate composite tenant foreign keys/unique keys and database checks in Step 2, with a data audit before migration.
- Tests: migration tests and direct database attempts to create cross-tenant relationships.

### I-6 — Vessel code uniqueness is global instead of organization-scoped

- Classification: **IMPORTANT** (schema approval required)
- Affected code: `prisma/schema.prisma:351-379`, especially `code @unique`
- Evidence: other master-data codes are organization-scoped, but two organizations cannot use the same vessel code.
- Impact: unrelated tenants can block each other's valid identifiers and onboarding/imports can fail unexpectedly.
- Smallest safe remediation: replace global uniqueness with `@@unique([organizationId, code])` after checking existing data and migration history.
- Tests: two-organization duplicate-code acceptance and same-organization rejection.

## Post-MVP backlog

### P-1 — Add global error UI and operational observability

- Classification: **POST-MVP**
- Affected code: no `app/error.tsx` or `app/global-error.tsx`; route handlers use unstructured `console.error`.
- Evidence: Next.js production guidance recommends global error UI; server logs have no request/correlation identifiers or structured event schema.
- Impact: weaker recovery experience and slower incident diagnosis.
- Smallest safe remediation: add accessible error boundaries and structured, redacted logging with request IDs and an error-monitoring sink.
- Tests: forced render/API failures, redaction assertions, and recovery action tests.

### P-2 — Add a dedicated readiness contract

- Classification: **POST-MVP**
- Affected code: `app/api/health/route.ts`
- Evidence: `/api/health` correctly checks the database and returns 503 on failure, but liveness and readiness are not distinguished and deployment monitoring is not documented.
- Impact: less precise orchestration/alert behavior.
- Smallest safe remediation: document the endpoint contract or split liveness/readiness if the hosting platform needs both.
- Tests: database-up/down response and timeout tests.

## Verified controls

- **VERIFIED — Server-derived organization context:** `lib/auth/current-user.ts` validates the Supabase user, active DB user, active membership, and active organization; an untrusted organization cookie is accepted only if it matches the user's active memberships.
- **VERIFIED — Operational API scoping:** reviewed companies, ports, terminals, berths, vessels, services, schedules, planner reads/changes, memberships, invitations, and organization audit logs. Queries derive `organizationId` from `requireCurrentUser()` and foreign IDs are checked in the active organization.
- **VERIFIED — Platform Admin boundaries:** reviewed platform request/audit pages and APIs; server handlers require `platformRole === SUPER_ADMIN`.
- **VERIFIED — Role escalation controls:** member mutations prevent self-modification, OWNER assignment by PATCH, ADMIN management of ADMIN/OWNER, and non-OWNER ownership transfer; transfer rechecks the requester in its transaction.
- **VERIFIED — Invitation token storage:** 32 random bytes, SHA-256 hash at rest, unique `tokenHash`, seven-day expiry, conditional one-time acceptance, exact normalized email matching, and audit redaction of token-like keys. Raw links are returned once and passed to email delivery without persistence.
- **VERIFIED — Authentication provider usage:** passwords and password hashing are delegated to Supabase Auth; app code does not store password material. Forgot-password responses do not enumerate users. Supabase production policy/configuration still requires external verification.
- **VERIFIED — Session cookies:** Supabase SSR manages auth cookies; the application organization cookie is HTTP-only, SameSite=Lax, Secure in production, scoped to `/`, and revalidated against live memberships on each use.
- **VERIFIED — XSS review:** no `dangerouslySetInnerHTML`/direct DOM HTML sink was found. React renders user data, and invitation email HTML/header values are escaped/sanitized.
- **VERIFIED — Error disclosure:** API responses generally return generic server errors while details remain server-side. Audit sanitization redacts tokens, secrets, cookies, sessions, authorization data, and oversized payloads.
- **VERIFIED — Development tooling guards:** planner seed/explain/benchmark scripts refuse `NODE_ENV=production` and unapproved remote databases; browser performance instrumentation is disabled in production.
- **VERIFIED — Secrets:** `.env` is ignored and not tracked; `.env.example` contains placeholders only.
- **VERIFIED — Health check:** `/api/health` performs a database query and returns 503 without returning the underlying exception.
- **VERIFIED — Planner client behavior:** normal planner create/edit/move/resize/undo paths refresh data in place rather than doing a full-page reload; polling has bounded retry/delay helpers covered by unit tests.
- **VERIFIED — Export scope:** weekly PDF export is client-side and uses only planner data already returned by the organization/terminal-scoped API; no unauthenticated file/export endpoint exists.

## Verification results

| Command | Result |
| --- | --- |
| `npx prisma validate` | PASS — schema valid |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `node --import tsx --test $(rg --files -g '*.test.ts' \| sort)` | PASS — 126/126, including RB-1, RB-2 and RB-3 PostgreSQL suites |
| `npm run build` | PASS — 45 routes/pages generated; initial sandbox run could not fetch Google Fonts, approved network rerun passed |
| `npm audit --audit-level=low` | FAIL — 12 high after Prisma patch (was 15 high, 1 moderate) |
| `npm audit --omit=dev --audit-level=low` | FAIL — 3 high in the normal optional-inclusive tree (was 6 high, 1 moderate) |
| clean `npm ci --omit=dev --omit=optional` audit | FAIL — Next/PostCSS only: 1 high, 1 moderate; Sharp/ESLint/Prisma CLI absent |
| clean no-Sharp build/start smoke | PASS — 45 routes, auth page, planner redirect, fonts/static assets; weekly PDF test passes |
| `git diff --check` | PASS after RB-4 documentation update |

The repository has no named `test`, `typecheck`, or security-audit scripts; the commands above were discovered and invoked directly.

## Verification database connection incident — closed 2026-07-30

- Cause: the verification command overrode `DATABASE_URL` only. The former `prisma.config.ts` loaded `.env` and selected `DIRECT_URL`, so Prisma ignored the disposable target for migrations.
- Sanitized production target: `aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`. `DATABASE_URL` uses the same host/database on port 6543. Credentials were never included in the incident report.
- Classification: production, based on the configured `https://www.getflowport.com` application target and explicit owner confirmation for read-only inspection.
- Evidence before/after: the original CLI transcript reported 20 repository migrations and applied only `20260729213000_add_organization_approval_progress`. No independent pre-incident database snapshot exists. The current read-only inspection found exactly one completed record, started `2026-07-29T16:44:17.019Z`, finished `2026-07-29T16:44:17.808Z`, one applied step, no rollback, and no stored migration log.
- Checksum: database and repository both contain `b5ded2722e32851292277eb95ebdb2347383f8affed3904aa7aa8a46355c2133`.
- Later migrations: none in the database and none after this migration in the repository.
- Schema consistency: the database has nullable UUID `approvalClaimId`, nullable timestamp `approvalClaimedAt`, non-null integer `approvalVersion DEFAULT 0`, nullable `OrganizationApprovalStage` `approvalStage`, all four expected enum values, and `organization_requests_approvalClaimedAt_idx`.
- Logs/history: `_prisma_migrations.logs` is empty. No provider dashboard/server logs were available through the existing safe database tooling, so none were accessed.
- Disposition: repository migration history, database history, and resulting schema are consistent. No repair, rollback, manual migration-table edit, or compensating migration is required. The incident does not block release.

## Database target guard and safe migration commands

- `prisma.config.ts` no longer loads `.env`. Every Prisma CLI invocation requires explicit `DATABASE_ENVIRONMENT`, `DATABASE_URL`, and `DIRECT_URL`.
- Both targets must resolve to the same host/database or carry an exact sanitized pair approval. Remote development, staging, and production targets require `DATABASE_TARGET_APPROVAL=<classification>@<host>:<port>/<database>`.
- Integration tests require their `RB*_TEST_DATABASE_URL` to match the explicit `DATABASE_URL`; tests, seeds, benchmarks, and EXPLAIN refuse production classification.
- Migration wrappers print only the classification and sanitized host/port/database before invoking Prisma.

Safe local command:

```bash
DATABASE_ENVIRONMENT=test \
DATABASE_URL="$LOCAL_DATABASE_URL" \
DIRECT_URL="$LOCAL_DIRECT_URL" \
npm run db:migrate:deploy
```

Safe staging status/deploy:

```bash
DATABASE_ENVIRONMENT=staging \
DATABASE_URL="$STAGING_DATABASE_URL" \
DIRECT_URL="$STAGING_DIRECT_URL" \
DATABASE_TARGET_APPROVAL="staging@staging-db.example:5432/app" \
npm run db:migrate:status

# After reviewing the sanitized target printed by status:
DATABASE_ENVIRONMENT=staging \
DATABASE_URL="$STAGING_DATABASE_URL" \
DIRECT_URL="$STAGING_DIRECT_URL" \
DATABASE_TARGET_APPROVAL="staging@staging-db.example:5432/app" \
npm run db:migrate:deploy
```

Safe production process:

```bash
DATABASE_ENVIRONMENT=production \
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
DIRECT_URL="$PRODUCTION_DIRECT_URL" \
DATABASE_TARGET_APPROVAL="production@production-db.example:5432/app" \
npm run db:migrate:status

# Run deploy only in the same explicitly populated, approved environment after review:
DATABASE_ENVIRONMENT=production \
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
DIRECT_URL="$PRODUCTION_DIRECT_URL" \
DATABASE_TARGET_APPROVAL="production@production-db.example:5432/app" \
npm run db:migrate:deploy
```

The URL variables above must come from the approved secret manager. Never paste complete URLs into logs or documentation.

## Recommended fix order

1. Upgrade to the first supported stable Next release declaring PostCSS >=8.5.18, no later than the 2026-08-28 exception expiry.
2. Add database-backed role/tenant/isolation tests beyond the completed RB-1, RB-2 and RB-3 suites.
3. Add durable abuse controls and verify Supabase production settings.
4. Add centralized environment validation and security headers.
5. Complete Step 2 database readiness items below.

## Step 2 — Database readiness remaining

- Compare every migration checksum/history with the target non-production deployment environment; do not use production data for this audit.
- Run `prisma migrate status` against an approved staging database.
- Audit existing rows for cross-tenant foreign relationships, invalid berth geometry, overlapping schedules, duplicate owner states, contradictory invitation timestamps/statuses, and duplicate vessel codes.
- Decide and migrate composite tenant foreign keys and organization-scoped vessel code uniqueness.
- Add database constraints/checks for positive vessel/berth dimensions and valid schedule placement where feasible.
- Define the transaction/locking strategy for conflict enforcement and approval idempotency.
- Verify backup, restore, connection limits/pooling, migration rollback/roll-forward, least-privilege database credentials, and health-query timeouts.
