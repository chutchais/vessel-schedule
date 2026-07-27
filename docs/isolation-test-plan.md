# Isolation test plan

## Goal
Validate Supabase-authenticated organization context and tenant-safe API behavior across two organizations.

## Test data setup
- Create Organization A and Organization B.
- Create one active user with memberships in both orgs.
- Create one user with access only to Organization A.
- Seed distinct companies, ports, terminals, berths, vessels, services, and schedules in each org.
- Ensure at least one shipping line company exists per org.

## Manual test cases

### Authentication and routing
1. Visit `/login` while signed out and confirm the auth layout renders without the app shell.
2. Visit `/companies` while signed out and confirm redirect to `/login?next=/companies`.
3. Sign in and confirm redirect to the requested protected page.
4. Trigger forgot-password flow and confirm recovery links redirect to `/reset-password`.
5. Sign out and confirm protected pages redirect back to login.

### Organization context
1. Sign in as a dual-membership user and confirm `/api/auth/me` returns both organizations.
2. Confirm the highest-priority membership becomes active when no `active_organization_id` cookie exists.
3. Switch organizations from the sidebar and confirm `active_organization_id` cookie updates.
4. Refresh the app and confirm the selected organization remains active.

### Read isolation
1. In Organization A, confirm list endpoints only return A records:
   - `/api/companies`
   - `/api/ports`
   - `/api/terminals`
   - `/api/berths`
   - `/api/vessels`
   - `/api/services`
   - `/api/schedules`
2. Switch to Organization B and confirm only B records are returned.
3. As the single-org user, attempt to switch to Organization B via `/api/auth/active-organization` and confirm `403`.

### Write isolation
1. In Organization A, create a company with a code that already exists in Organization B and confirm creation succeeds.
2. In Organization A, create another company with a duplicate A code and confirm `409`.
3. Repeat duplicate-scope validation for ports, terminals, berths, and services.
4. Create a vessel in Organization A using a globally unique code and confirm success.
5. Attempt to create a vessel in Organization B with the same code and confirm `409`.
6. Attempt to reuse an IMO within the same organization and confirm `409`.

### Cross-organization relationship protection
1. In Organization A, attempt to create a terminal using a `portId` from Organization B and confirm `404`.
2. In Organization A, attempt to create or update a berth using a `terminalId` from Organization B and confirm `404`.
3. In Organization A, attempt to create or update a service using a `companyId` from Organization B and confirm `404`.
4. Attempt to use a non-shipping-line company for a service and confirm `400`.
5. In Organization A, attempt to create or update a schedule using vessel, terminal, berth, or service IDs from Organization B and confirm `404`.
6. Attempt to assign a berth from the same org but a different terminal and confirm `400`.

### Permissions
1. As VIEWER, confirm GET endpoints succeed but POST/PATCH master data endpoints return `403`.
2. As PLANNER, confirm schedule create/update succeeds but company/port/service create/update returns `403`.
3. As ADMIN, confirm master data and schedules can be created/updated.
4. As OWNER, confirm the same behavior as ADMIN for current implemented endpoints.

### Schedule overlap
1. In Organization A, create a schedule on a berth for a valid time window.
2. In Organization B, create an overlapping schedule on a berth with the same code but different org and confirm success.
3. Back in Organization A, create an overlapping schedule on the same berth and confirm `409`.
4. Update an existing schedule without changing its own berth window and confirm it still saves.
