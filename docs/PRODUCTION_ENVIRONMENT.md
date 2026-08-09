# FlowPort production environment

Target origin: `https://getflowport.com`  
Status: invite-only pilot

Use the hosting provider's encrypted environment/secret manager. The examples below are placeholders or public configuration only. Never commit real database credentials, Supabase secret keys, SMTP credentials, invitation tokens, planner-share fragments, or local `.env` files.

## Required variables

| Variable | Exposure | Purpose | Safe example |
| --- | --- | --- | --- |
| `NODE_ENV` | Server | Enables production behavior, secure cookies, and production email validation | `production` |
| `DATABASE_URL` | Secret, server | Normal Prisma application connection, normally through the Supabase pooler | `postgresql://flowport_app:replace-with-secret@pooler.example.invalid:6543/flowport?sslmode=require` |
| `DIRECT_URL` | Secret, migration job | Direct connection used by Prisma migration commands | `postgresql://flowport_migrator:replace-with-secret@db.example.invalid:5432/flowport?sslmode=require` |
| `DATABASE_ENVIRONMENT` | Server/migration job | Explicit database classification required by the target guard | `production` |
| `DATABASE_TARGET_APPROVAL` | Migration job | Human approval of the sanitized direct target | `production@db.example.invalid:5432/flowport` |
| `DATABASE_TARGET_PAIR_APPROVAL` | Conditional migration job | Approves the sanitized pooled/direct pair when their host identities differ | `pooler.example.invalid:6543/flowport\|db.example.invalid:5432/flowport` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public, build/runtime | Production Supabase project URL used by browser and server clients | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public, build/runtime | Supabase publishable/anon key | `replace-with-publishable-key` |
| `SUPABASE_SECRET_KEY` | Secret, server | Supabase admin operations; must never be browser-exposed | `replace-with-server-secret-key` |
| `APP_URL` | Server | Server-side canonical origin validation | `https://getflowport.com` |
| `NEXT_PUBLIC_APP_URL` | Public, build/runtime | Canonical origin for callbacks, invitation links, recovery links, logout, and planner shares | `https://getflowport.com` |
| `SMTP_HOST` | Server | Application organization-invitation SMTP host | `smtp.example.com` |
| `SMTP_PORT` | Server | Application SMTP TLS port | `465` |
| `SMTP_SECURE` | Server | Requires an immediately secured TLS connection in production | `true` |
| `SMTP_USER` | Secret, server | Application SMTP username | `replace-with-smtp-user` |
| `SMTP_PASSWORD` | Secret, server | Application SMTP password | `replace-with-a-secret` |
| `EMAIL_FROM` | Server | Verified sender identity for organization invitations | `FlowPort <no-reply@getflowport.com>` |
| `EMAIL_DELIVERY_MODE` | Server | Explicitly enables SMTP delivery or fail-closed validation mode | `disabled` for private validation; `smtp` only with verified SMTP |
| `PUBLIC_PLANNER_SHARING_ENABLED` | Server | Fail-closed feature flag for all share management and public share routes | `false` |
| `PUBLIC_PLANNER_TRUSTED_PROXY_HOPS` | Server | Number of trusted reverse-proxy hops used to derive public rate-limit identity | `0` until hosting topology is verified |
| `PORT` | Server, optional | Port consumed by `next start`; hosting platforms commonly inject it | `3000` |

`DATABASE_TARGET_PAIR_APPROVAL` is required only when `DATABASE_URL` and `DIRECT_URL` do not resolve to the same host/database identity. Derive both approval strings from the target guard's sanitized output and obtain release approval; do not copy the example.

The one-time bootstrap variables below are not normal deployment variables and must not remain in the runtime environment:

- `BOOTSTRAP_AUTH_USER_ID`
- `BOOTSTRAP_USER_EMAIL`
- `BOOTSTRAP_USER_DISPLAY_NAME`
- `BOOTSTRAP_ORGANIZATION_SLUG`

## Canonical URL behavior

`APP_URL` and `NEXT_PUBLIC_APP_URL` are both required and must resolve to the same origin. Production permits HTTPS; plain HTTP is accepted only for localhost development. Values with credentials, paths, query parameters, or fragments are rejected.

`NEXT_PUBLIC_APP_URL` is the canonical application URL used by shared browser/server URL construction. `APP_URL` is its required server-side mirror and is rejected when it differs. For production, set both to `https://getflowport.com`; do not replace configured URL construction with a hard-coded hostname.

FlowPort uses the validated configured origin—not the incoming Host header or `window.location.origin`—for:

- Supabase invitation and registration callbacks
- password-recovery callbacks
- organization invitation acceptance links
- public planner share links
- authentication callback destinations and logout redirects

The authentication callback exchanges a Supabase code before continuing, routes recovery only to `/reset-password`, and accepts `next` only when it is a root-relative path on the configured FlowPort origin. Missing or failed exchanges return to Sign In with a generic error identifier.

## Supabase settings that remain manual

Repository variables do not configure the hosted Supabase dashboard. Before release, manually verify:

- Auth Site URL: `https://getflowport.com`.
- Production allowed redirect URLs:
  - `https://getflowport.com/auth/callback`
  - `https://getflowport.com/auth/callback?type=recovery`
- Authentication confirmation/invitation callback: `https://getflowport.com/auth/callback`.
- Password-recovery callback: `https://getflowport.com/auth/callback?type=recovery`.
- If private validation uses a separate preview origin, add only these exact URLs after replacing `<private-validation-host>` with the hosting-provider-assigned hostname:
  - `https://<private-validation-host>/auth/callback`
  - `https://<private-validation-host>/auth/callback?type=recovery`
- Do not add a wildcard preview redirect. Do not add preview URLs when validation uses `getflowport.com` itself.
- Wildcard and preview redirects are absent from the production project.
- Public signup behavior enforces the invite-only policy.
- Password, email confirmation, refresh-token/session, CAPTCHA, and auth rate-limit policies are approved.
- The production publishable and secret keys belong to the intended project; the secret key is server-only.
- Data API grants/RLS do not expose Prisma-managed application tables to browser roles.
- Database TLS, network restrictions, connection limits, backups/PITR, and restore access are configured.

The checked-in `supabase/config.toml` is for local development and is not evidence of any hosted setting.

## Production email configuration

FlowPort has two possible email paths and both must be configured and tested:

1. Application SMTP sends organization invitation mail using `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`. Production fails closed when this configuration is incomplete.
2. Supabase Auth sends provider-managed confirmation, invitation, and password-recovery messages. Configure its production SMTP/templates separately in the Supabase dashboard.

Verify the `getflowport.com` sending identity with the provider and publish provider-supplied SPF, DKIM, and DMARC records. Test delivery, spam placement, expiry, revocation, and trusted callback domains. Do not log message bodies or URLs containing invitation tokens.

`EMAIL_DELIVERY_MODE` is mandatory and fail-closed:

- `disabled`: safe private-validation mode. Access requests remain recordable and explicitly say that no confirmation email was sent. Creating, replacing, retrying, and copying newly generated invitation links are disabled in both the API and invitation UI. Existing invitations may still be revoked.
- `smtp`: enables invitation email actions only when every SMTP variable above is present and verified. A transport failure is recorded and shown as failed; FlowPort never reports it as sent.
- Missing or unrecognized values behave as `disabled`.

Supabase Auth email remains a separate provider-controlled channel. `EMAIL_DELIVERY_MODE=disabled` does not claim to configure or disable Supabase Auth mail; verify that channel manually before exercising password recovery or email confirmation.

## DNS and HTTPS manual checklist

Do not infer DNS targets from the framework or repository. Obtain the exact values from the selected hosting project's custom-domain screen.

- [ ] Add the provider-issued domain verification TXT record, if requested.
- [ ] Add the exact provider-issued apex record type and value (A/AAAA, ALIAS, or ANAME as instructed).
- [ ] Add the exact provider-issued `www` CNAME target if `www.getflowport.com` will be served or redirected.
- [ ] Remove only records the provider explicitly identifies as conflicting; preserve unrelated mail and verification records.
- [ ] Verify public DNS resolution from multiple resolvers.
- [ ] Wait for the provider-issued TLS certificate to become active and confirm automatic renewal.
- [ ] Force HTTP to HTTPS and choose one canonical host; redirect `www` to `https://getflowport.com` if the apex is canonical.
- [ ] Verify `/api/health` over HTTPS after deployment without exposing internal details.

DNS changes and HTTPS activation remain manual pending actions.

## Safe database migration workflow

`prisma.config.ts` deliberately does not load `.env`. The repository wrappers validate the target before calling Prisma and print only database classification plus sanitized host/port/database identifiers.

Permitted production sequence, after staging rehearsal and a verified recoverable backup:

1. Populate the database variables in an isolated approved migration job.
2. Run `npm run db:migrate:status` and review the sanitized target and pending set.
3. Stop if the target or migration set differs from the approved plan.
4. Run `npm run db:migrate:deploy` once.
5. Run `npm run db:migrate:status` again.

Never use `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, seed, benchmark, or EXPLAIN commands against production. The production state was not queried while preparing this document.

## Public planner sharing

Keep `PUBLIC_PLANNER_SHARING_ENABLED=false` until its migration is confirmed and proxy/cache/expiry/revocation tests pass. Management endpoints, public session exchange, public data access, and the public page all check the same fail-closed flag.

Set `PUBLIC_PLANNER_TRUSTED_PROXY_HOPS` only after the hosting provider confirms the inbound proxy chain. `0` ignores forwarded addresses and groups callers under a fallback identity; an incorrect positive value may trust attacker-controlled forwarding data.

## Logging and health

Production application routes log static event labels only. Dynamic exception objects and messages are not written to application logs, preventing provider errors from exposing passwords, database URLs, invitation tokens, cookies, or planner-share secrets. Database target scripts print sanitized target identifiers, never credentials.

`GET /api/health` performs a database liveness query and returns only `{"status":"ok"}` or `{"status":"error"}` with `Cache-Control: no-store`. It does not return target identifiers, credentials, exception details, migration state, or organization data.

Hosting-side structured logging, retention, access controls, alerting, and secret scanning still require manual configuration.

## Git and secret handling

The root `.gitignore` excludes `.env*` except the placeholder-only `.env.example`, plus common private-key, certificate-container, credentials, and secrets files. Supabase local environment files are separately ignored. Before every release, run an approved full-history secret scanner configured to redact matches, and rotate any credential whose confidentiality is uncertain.

## Build and runtime

- Install: `npm ci`
- Build: `npm run build`
- Start: `npm run start`
- RB4 artifact verification: build first, prune dev/optional dependencies, then run `npm run verify:rb4-runtime` and the narrow production smoke command.

The RB4 exception expires on **2026-08-28 at 23:59:59.999 UTC**. An expired or failing exception check is a deployment NO-GO.
