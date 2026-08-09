# Local Supabase Auth setup for Authentication E2E Batch 1

This repository does not include Supabase local configuration by default.
Use this minimum setup for **local-only** authentication E2E.

1. Install Supabase CLI (local machine requirement), then initialize local config:
   - `supabase init`
2. Start local Supabase services:
   - `supabase start`
3. Copy `.env.e2e.local.example` to `.env.e2e.local` and set local values only:
   - `NEXT_PUBLIC_SUPABASE_URL` must be localhost/127.0.0.1.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` must come from local Supabase output.
   - `APP_URL` and `NEXT_PUBLIC_APP_URL` must match the E2E app origin (`http://127.0.0.1:3201`).
4. Keep Prisma test DB local and aligned with RB suites:
   - `.env.test.local` must use `DATABASE_ENVIRONMENT=test`.
   - `DATABASE_URL`, `DIRECT_URL`, `RB1_TEST_DATABASE_URL`, `RB2_TEST_DATABASE_URL`, `RB3_TEST_DATABASE_URL` must resolve to the same local DB.
5. Run preflight:
   - `npm run test:e2e:preflight`

Architecture for this batch uses **separate local databases**:
- Prisma app/RB suites: PostgreSQL at `127.0.0.1:55432` (`vessel_test`)
- Supabase local stack: Supabase-managed local Postgres/Auth services

No hosted Supabase/staging/production credentials are allowed in E2E.
