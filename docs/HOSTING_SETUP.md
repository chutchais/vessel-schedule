# FlowPort hosting setup

## Detected hosting provider

**None configured in this repository.** There is no provider manifest or deployment configuration for Vercel, Netlify, Render, Railway, Fly.io, Docker, or another hosting service. `public/vercel.svg` is a static asset only; it is not hosting configuration.

Choose a provider that supports the current Next.js release on a full Node.js runtime, server-side environment variables, outbound PostgreSQL and SMTP TCP connections, custom domains, HTTPS, and a temporary HTTPS deployment URL.

## Runtime and build settings

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Production build command | `npm run build` |
| Node server start command | `npm run start` |
| Build output | Default Next.js output: `.next` |
| Node.js version | Node.js `24.x`; repository CI uses `24` and the validated runtime is `v24.18.0` |
| Health endpoint | `GET /api/health` |

No `output: "standalone"`, static-export output, Dockerfile, custom server, cron process, queue worker, or persistent local-storage requirement is configured.

FlowPort is **not** a static-only site: it has authenticated dynamic pages, API route handlers, Prisma/PostgreSQL access, Supabase server calls, and server-side SMTP. It does not need a permanently running application process or an application-level scheduled job, so it can run on a serverless Next.js host **if** that host provides a full Node.js runtime and permits outbound TCP to PostgreSQL and the SMTP provider. A traditional persistent Node.js service also works and should use `npm run start`.

Application state is persisted in Supabase PostgreSQL. Do not rely on local disk for data. The only repository schedule is the weekly GitHub Actions dependency-control workflow; it is not an application runtime job.

## 1. Create the production hosting project

1. In the selected hosting provider, create a new project from `chutchais/vessel-schedule`.
2. Set the project root to the repository root.
3. Select Node.js `24.x` (prefer the validated `v24.18.0` where the provider supports an exact version).
4. Use `npm ci` for installation and `npm run build` for the build command.
5. For a managed Next.js provider, use its native Next.js deployment mode; it should invoke the generated Next.js functions/routes. For a general Node host, configure `npm run start` and let the provider supply `PORT`.
6. Keep the first deployment private and use the provider-assigned temporary HTTPS URL. Do not attach or change DNS yet.

Before deploying, confirm the provider supports Node TCP sockets. FlowPort's SMTP connection check and email sender use `node:net` / `node:tls`, and Prisma uses PostgreSQL network connections.

## 2. Environment-variable checklist

Configure values in the provider's encrypted environment/secret manager. Names only are listed here; never put values in this file, build logs, tickets, or browser-visible configuration.

### Runtime and database

- `NODE_ENV`
- `DATABASE_URL`
- `DIRECT_URL`
- `DATABASE_ENVIRONMENT`
- `DATABASE_TARGET_APPROVAL`
- `DATABASE_TARGET_PAIR_APPROVAL` — required only when the pooled and direct database targets have different host/database identities
- `PORT` — optional; most providers inject it automatically

Use `DATABASE_URL` for normal application traffic (normally the Supabase pooler). Reserve `DIRECT_URL` for Prisma migration commands in an isolated approved migration job. Both are server-only secrets. Do not run migrations as part of the application deployment, and do not use `prisma migrate dev`, `prisma db push`, or a migration deploy command from the hosting build.

### Application URLs

- `APP_URL`
- `NEXT_PUBLIC_APP_URL`

Both are required. They must be the same origin, with no path, query, fragment, or embedded credentials. Set both to the provider's temporary HTTPS URL for a temporary-host validation deployment; set both to `https://getflowport.com` for the final production-domain deployment. Because `NEXT_PUBLIC_APP_URL` is public build-time configuration, redeploy after changing it.

### Supabase

Public build/runtime variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only variable:

- `SUPABASE_SECRET_KEY`

Never prefix `SUPABASE_SECRET_KEY` with `NEXT_PUBLIC_`.

### Application SMTP

- `EMAIL_DELIVERY_MODE`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `EMAIL_FROM`

All SMTP settings are server-only. For a no-email private validation, use the explicit disabled email-delivery mode. Use SMTP mode only after every SMTP status item is configured and verified through the Platform Admin SMTP page.

### Public planner sharing

- `PUBLIC_PLANNER_SHARING_ENABLED`
- `PUBLIC_PLANNER_TRUSTED_PROXY_HOPS`

Safe pilot value: set `PUBLIC_PLANNER_SHARING_ENABLED=false`. Keep it false until its migration, public-cache controls, expiry/revocation tests, and exact proxy-hop value are independently approved. Set `PUBLIC_PLANNER_TRUSTED_PROXY_HOPS=0` until the provider confirms the actual trusted proxy chain.

The one-time bootstrap variables are not normal hosting runtime configuration and must not be set for deployment: `BOOTSTRAP_AUTH_USER_ID`, `BOOTSTRAP_USER_EMAIL`, `BOOTSTRAP_USER_DISPLAY_NAME`, and `BOOTSTRAP_ORGANIZATION_SLUG`.

## 3. Deploy commit `e86a542…`

1. In the provider's source/deployment UI, select repository commit `e86a54257d8b22d08385e410d9e39e4b0407d92e` exactly.
2. Confirm the displayed commit SHA before starting the deployment. Do not substitute a newer `main` commit.
3. Add the environment variables above in the provider's production/private-validation scope, using the temporary HTTPS origin for both application URL variables during temporary-host testing.
4. Trigger one deployment from that exact commit. Do not run database migrations from the build or deploy hook.
5. Record the provider deployment ID, commit SHA, temporary HTTPS URL, and build log location outside this repository. Do not copy secret values into the record.

If the provider deploys branches rather than a selected commit, use its documented commit-deployment feature or have a release owner create a reviewed, immutable reference at the exact SHA. Do not guess a provider-specific workflow.

## 4. Test with the temporary HTTPS URL

1. Wait for the provider to report HTTPS ready.
2. Confirm the temporary URL serves `/`, `/login`, `/privacy`, and `GET /api/health` over HTTPS.
3. Confirm `/api/health` returns only the generic status response and includes `Cache-Control: no-store`.
4. Confirm an unauthenticated request to `/berth-planner` redirects to `/login`.
5. For authentication flows on the temporary hostname, manually add these exact temporary URLs to the relevant Supabase project's redirect allowlist before testing:
   - `https://<provider-temporary-host>/auth/callback`
   - `https://<provider-temporary-host>/auth/callback?type=recovery`
6. Sign in only after the temporary origin has matching `APP_URL` and `NEXT_PUBLIC_APP_URL` values. Test the restricted Platform Admin SMTP page only when SMTP is intentionally configured.
7. Review provider logs for the smoke requests and confirm they contain no database URLs, tokens, cookies, or SMTP credentials.

Do not use wildcard Supabase redirects. Remove a temporary redirect when it is no longer required according to the approved access policy.

## 5. Attach `getflowport.com`

1. In the hosting provider's custom-domain screen, add `getflowport.com` and choose it as the canonical host.
2. Copy the provider's exact verification and DNS instructions. Do not infer record values from this repository or from another provider.
3. In the DNS provider, create only the records the hosting provider displays:
   - domain-verification `TXT`, if requested;
   - the exact apex record type and value (`A`, `AAAA`, `ALIAS`, or `ANAME`) shown by the provider;
   - the exact `www` `CNAME` target, if `www` will be served or redirected.
4. Preserve unrelated SPF, DKIM, DMARC, Supabase, and existing verification records. Remove a conflicting record only when the hosting provider explicitly identifies it.
5. Wait for DNS propagation and provider-issued HTTPS activation. Configure HTTP-to-HTTPS and `www`-to-apex redirects in the provider, if supported.
6. Update both `APP_URL` and `NEXT_PUBLIC_APP_URL` to `https://getflowport.com`, update the Supabase Site URL and exact allowed redirect URLs through the approved manual process, then redeploy the same reviewed commit.

## 6. Final verification

1. Confirm the deployed commit remains `e86a54257d8b22d08385e410d9e39e4b0407d92e`.
2. Confirm `https://getflowport.com`, `/login`, `/privacy`, and `/api/health` work over a valid certificate; check the health response is safe and non-cacheable.
3. Confirm `APP_URL` and `NEXT_PUBLIC_APP_URL` are both exactly `https://getflowport.com` in the deployment environment.
4. Confirm the Supabase Auth Site URL and allowed redirects are exactly:
   - `https://getflowport.com/auth/callback`
   - `https://getflowport.com/auth/callback?type=recovery`
5. Run the guarded migration status command only from the approved isolated migration environment; do not deploy migrations as part of this hosting task.
6. Confirm a real restorable Supabase backup and restore owner before any migration or pilot release.
7. Keep `PUBLIC_PLANNER_SHARING_ENABLED=false` for the pilot unless separately approved.
8. If SMTP is enabled, sign in as a Platform Admin and confirm all SMTP status rows are configured, the connection check succeeds, and the test email arrives only at the signed-in verified admin address.
9. Confirm provider logs and application audit records do not expose secrets.
