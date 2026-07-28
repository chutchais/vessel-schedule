Fix the layout problem where these Platform Administration pages render full-screen without the normal application sidebar:

```text
/admin/organization-requests
/admin/audit-logs
```

Other authenticated pages correctly display the shared application shell and sidebar.

## Before changing code

Inspect:

* All `layout.tsx` files under `app/`
* Any route groups such as `(public)` and `(dashboard)`
* `app-shell.tsx`
* Sidebar and mobile-navigation components
* Organization Requests page
* Platform Audit Log page
* Authentication and authorization helpers
* Proxy or middleware route protection
* Existing CSS affecting sidebar visibility or page width

Read the relevant layout and route-group documentation in:

```text
node_modules/next/dist/docs/
```

Determine the actual cause before editing.

Likely causes to investigate:

* Admin pages are outside the authenticated dashboard route group.
* An `app/admin/layout.tsx` replaces the shared application shell.
* Admin pages render a separate full-screen layout.
* A layout passes a prop that disables the sidebar.
* Admin pages use fixed/full-screen CSS that covers the shell.
* The sidebar component incorrectly hides itself on `/admin/*`.
* Platform navigation is incorrectly treated as public navigation.

Do not guess and do not add duplicate sidebars.

## Expected behavior

Both pages must render inside the same authenticated application shell used by:

```text
/companies
/ports
/terminals
/berths
/vessels
/services
/schedules
/settings/members
/audit-logs
```

Desktop layout:

```text
Shared sidebar | Platform Administration page
```

Mobile layout:

```text
Shared mobile header/navigation
Platform Administration page content
```

The sidebar should remain visible and functional on desktop.

The mobile navigation should remain functional on mobile.

## Recommended route structure

If the project uses route groups, place admin pages inside the same authenticated route group:

```text
app/
├── (public)/
│   ├── login/
│   ├── request-access/
│   └── forgot-password/
│
└── (dashboard)/
    ├── layout.tsx
    ├── companies/
    ├── vessels/
    ├── schedules/
    ├── settings/
    ├── audit-logs/
    └── admin/
        ├── organization-requests/
        │   └── page.tsx
        └── audit-logs/
            └── page.tsx
```

Route groups must not change the URLs:

```text
app/(dashboard)/admin/organization-requests/page.tsx
→ /admin/organization-requests

app/(dashboard)/admin/audit-logs/page.tsx
→ /admin/audit-logs
```

If moving the files is unnecessary, fix the current layout hierarchy in the smallest safe way.

Do not wrap each page individually in another `AppShell` if the authenticated parent layout already provides it. There must be exactly one application shell and one sidebar.

## Shared dashboard layout

The authenticated dashboard layout should:

* Resolve the authenticated current user.
* Require an active User.
* Require an active organization membership where appropriate.
* Pass current user, active organization, available organizations, and role information to the application shell.
* Render the shared sidebar.
* Render mobile navigation.
* Render page content in the standard main-content area.

Platform pages still need access to the application shell even though their authorization uses `platformRole`.

Do not require organization OWNER status merely to render a platform page if `SUPER_ADMIN` authorization is the intended requirement.

## Platform authorization

Preserve strict authorization:

```text
/admin/organization-requests
/admin/audit-logs
```

must require:

```text
platformRole = SUPER_ADMIN
```

Do not weaken authorization to fix the layout.

The page or server layout must still prevent normal users, including organization Owners, from accessing platform pages.

The APIs must continue independently enforcing Super Admin authorization:

```text
/api/admin/organization-requests
/api/admin/audit-logs
```

Expected:

* Unauthenticated user → redirect to Login for pages
* Authenticated non-Super-Admin → 403 page or safe redirect
* Super Admin → page loads inside application shell
* API authorization remains JSON `401`/`403`, not HTML redirects

Do not rely only on hiding sidebar links.

## Sidebar behavior

Under:

```text
Platform Administration
```

show:

```text
Organization Requests
Audit Logs
```

only when:

```text
currentUser.platformRole === "SUPER_ADMIN"
```

Active navigation must work for:

```text
/admin/organization-requests
/admin/audit-logs
```

The active item should have the same visual treatment as other active navigation items.

Do not hide or collapse the entire sidebar on `/admin/*`.

Do not show platform links to normal organization users.

## Page layout consistency

Both admin pages should use the same page-content conventions as other dashboard pages:

* Shared PageHeader
* Standard content width
* Standard horizontal and vertical padding
* Consistent background
* Consistent cards, tables, filters, and drawers
* Responsive behavior
* No fixed overlay covering the sidebar
* No unnecessary `min-h-screen` nested inside the application shell
* No independent full-screen background wrapper
* No duplicate top navigation

Remove or adjust only CSS that causes these pages to escape or cover the shell.

Preserve:

* Existing filters
* Pagination
* Details drawer
* Approval/rejection actions
* Audit detail actions
* Loading states
* Error states
* Existing API calls
* Existing authorization

## Important constraints

* Do not change Prisma schema.
* Do not create a migration.
* Do not modify business logic.
* Do not change API response shapes.
* Do not weaken authentication.
* Do not weaken Super Admin checks.
* Do not make `/admin/*` public.
* Do not duplicate the application shell.
* Do not create a second sidebar implementation.
* Do not refactor unrelated management pages.
* Preserve existing user changes.
* Avoid broad formatting changes.
* Keep the implementation beginner-friendly.

## Manual verification

Test at desktop width:

1. Open `/companies`; sidebar appears.
2. Open `/admin/organization-requests`; the same sidebar appears.
3. Open `/admin/audit-logs`; the same sidebar appears.
4. Organization Requests active navigation is highlighted correctly.
5. Platform Audit Logs active navigation is highlighted correctly.
6. Page content does not overlap the sidebar.
7. Drawers and dialogs remain above content without permanently hiding the sidebar.

Test at mobile width:

8. Sidebar becomes mobile navigation.
9. Admin pages remain usable.
10. Tables scroll appropriately.
11. Drawers remain usable.
12. No horizontal page overflow outside intended table containers.

Authorization tests:

13. Guest cannot access either admin page.
14. Organization Owner without `SUPER_ADMIN` cannot access either page.
15. Planner and Viewer cannot access either page.
16. `SUPER_ADMIN` can access both pages.
17. Admin APIs continue returning JSON `401` or `403` when unauthorized.
18. Platform links appear only for `SUPER_ADMIN`.

## Verification commands

Run:

```bash
npm run lint
npm run build
git diff --check
git status
```

Fix errors introduced by this layout change.

Do not modify unrelated files only to remove pre-existing warnings.

## Final report

Report:

* Root cause of the missing sidebar
* Files moved, if any
* Files modified
* Layout hierarchy after the fix
* Sidebar behavior
* Mobile-navigation behavior
* Super Admin authorization behavior
* Manual verification results
* Lint result
* Build result
* Remaining pre-existing warnings
