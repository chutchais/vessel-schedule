Create a professional public landing page for the Vessel Schedule application.

The project uses:

* Next.js App Router
* React
* TypeScript
* Tailwind CSS
* Supabase Auth
* Prisma
* Shared UI components and an authenticated application shell

The landing page route must be:

```text
/
```

It must be publicly accessible and must not render the authenticated dashboard sidebar.

## Before writing code

Inspect:

* All `app/**/layout.tsx` files
* Existing route groups such as `(public)` and `(dashboard)`
* Current `app/page.tsx`
* Login and Request Access pages
* Shared Button and other UI components
* Global CSS and design tokens
* Authentication helpers
* Proxy or middleware public-route logic
* Current metadata
* Local Next.js documentation under `node_modules/next/dist/docs/`

Follow the project’s existing visual style.

Do not create a second unrelated design system.

## Route structure

Prefer:

```text
app/
├── (public)/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/
│   ├── forgot-password/
│   ├── reset-password/
│   └── request-access/
│
└── (dashboard)/
    ├── layout.tsx
    ├── companies/
    ├── vessels/
    ├── schedules/
    ├── settings/
    └── admin/
```

Route groups must not change the URL:

```text
app/(public)/page.tsx
→ /
```

Ensure there is only one page resolving to `/`. Move or replace the existing root page safely.

The public layout must not:

* Require authentication
* Require a Prisma User
* Require organization membership
* Render the dashboard sidebar
* Render platform administration navigation

The authenticated dashboard layout must remain unchanged.

## Public-route configuration

Ensure `/` is public.

Use exact matching for the root route.

Do not implement logic such as:

```ts
pathname.startsWith("/")
```

because that would make every route public.

Existing public routes should continue working:

```text
/
/login
/forgot-password
/reset-password
/request-access
/auth/callback
/api/health
/api/organization-requests
```

Do not make these public:

```text
/admin/*
/settings/*
/companies
/ports
/terminals
/berths
/vessels
/services
/schedules
/audit-logs
```

API authorization must remain unchanged.

## Design direction

Create a polished maritime operations landing page with:

* Light neutral background
* White surfaces
* Slate text
* Blue primary actions
* Subtle cyan/teal accents where appropriate
* Clear typography
* Generous but controlled spacing
* Subtle borders and shadows
* Responsive design
* Accessible contrast and focus states

Avoid:

* Excessive gradients
* Excessive animation
* Huge empty sections
* Fake customer logos
* Fake testimonials
* Fake usage statistics
* Claims about features that do not exist
* Stock photographs that do not add value
* An unrelated marketing theme

Use simple CSS/Tailwind visual elements where useful, such as a small abstract berth timeline preview. Do not display real organization, vessel, schedule, or user data.

## Header

Create a public header containing:

Left:

```text
Vessel Schedule
```

Optional subtitle or small maritime icon:

```text
Berth Planning & Operations
```

Navigation links:

```text
Features
How It Works
Security
```

Actions for guests:

```text
Sign In
Request Access
```

Use anchors for page sections:

```text
#features
#how-it-works
#security
```

Mobile requirements:

* Compact header
* Accessible menu button if navigation collapses
* Keyboard accessible
* Correct `aria-expanded`
* Easy-to-tap controls

Do not reuse the authenticated sidebar on the landing page.

## Optional authenticated state

The landing page may safely detect authentication on the server.

It must not throw an authentication error for guests.

Use or create an optional helper such as:

```ts
getOptionalCurrentUser()
```

It should return `null` instead of throwing when there is no authenticated user.

CTA behavior:

### Guest

Show:

```text
Sign In
Request Access
```

### Authenticated user with active membership

Show:

```text
Open Dashboard
```

Link to the most suitable existing authenticated route, such as:

```text
/schedules
```

### Authenticated user without membership

Show:

```text
View Invitations
```

Link:

```text
/invitations
```

### Super Admin

May also show:

```text
Platform Administration
```

Link:

```text
/admin/organization-requests
```

Do not expose the user’s organization data on the landing page.

If optional authenticated-state detection complicates public rendering, use guest actions only. Do not make the landing page depend on authentication.

## Hero section

Headline:

```text
Plan vessel calls with clarity
```

Supporting text:

```text
Manage vessels, services, terminals, berths, and port-call schedules in one organized workspace.
```

Primary CTA:

```text
Request Access
```

Link:

```text
/request-access
```

Secondary CTA:

```text
Sign In
```

Link:

```text
/login
```

For authenticated users, replace or supplement these actions according to the optional authenticated-state rules.

Add a simple visual preview representing:

* Berth rows
* Time scale
* Vessel schedule blocks
* ETA/ETD labels
* Service colors

This must be static demonstration content only.

Use generic example labels such as:

```text
Berth A
Berth B
Vessel 101
Service A1
08:00
14:00
```

Do not fetch operational API data for the public landing page.

## Features section

Section ID:

```text
features
```

Title:

```text
Everything needed for vessel scheduling
```

Include feature cards for functionality that exists or is already planned:

### Vessel schedules

```text
Coordinate vessel calls, voyage numbers, services, terminals, berths, and planned or actual times.
```

### Berth management

```text
Maintain berth length, display order, color, zero-origin direction, and vessel position.
```

### Master data

```text
Manage companies, ports, terminals, vessels, and shipping services in one consistent interface.
```

### Organization workspaces

```text
Keep each organization’s users and operational data separated.
```

### Roles and permissions

```text
Control access for Owners, Admins, Planners, and Viewers.
```

### Audit history

Only include this card if Audit Log is implemented:

```text
Review important changes with organization-scoped activity history.
```

If Audit Log is not finished, describe it as:

```text
Audit history is planned for a future release.
```

Do not describe the Berth Planner as complete if it has not been implemented.

If it is not complete, use:

```text
Visual berth planning is coming next.
```

## How It Works section

Section ID:

```text
how-it-works
```

Title:

```text
Start with a controlled organization workspace
```

Use four steps:

### 1. Request access

```text
Submit your organization or business name and contact details.
```

### 2. Platform review

```text
A platform administrator reviews and approves the organization request.
```

### 3. Invite your team

```text
The Organization Owner invites Admins, Planners, and Viewers.
```

### 4. Plan operations

```text
Create master data and coordinate vessel schedules within your private workspace.
```

Use real application terminology consistently.

## Security section

Section ID:

```text
security
```

Title:

```text
Designed around organization boundaries
```

Describe only implemented controls:

* Organization-scoped data access
* Server-side authentication checks
* Role-based permissions
* Verified invitation email matching
* Protected platform administration
* Server-only Supabase Admin operations

Do not claim:

* Formal compliance certifications
* Encryption features beyond the actual providers
* Penetration testing
* Guaranteed security
* Row Level Security unless it is actually implemented and tested
* Audit immutability beyond the actual implementation

Suggested text:

```text
Each request is evaluated using the authenticated user, active organization membership, and assigned role. Organization data is scoped on the server before database operations are performed.
```

## Final CTA

Add a clear final section:

Headline:

```text
Ready to organize your vessel schedules?
```

Guest actions:

```text
Request Access
Sign In
```

Authenticated action:

```text
Open Dashboard
```

Keep it concise.

## Footer

Include:

* Vessel Schedule
* Short product description
* Sign In
* Request Access
* Current year
* Privacy/Terms only if those pages exist

Do not create nonfunctional links.

Use a dynamic current year or a correct static value consistent with project conventions.

## Metadata and SEO

Add landing-page metadata:

```ts
title: "Vessel Schedule | Berth Planning and Maritime Operations"
description:
  "Manage vessel calls, services, terminals, berths, and schedules in an organization-based maritime operations workspace."
```

Also add where appropriate:

* Open Graph title
* Open Graph description
* Canonical metadata only if a production application URL is configured
* Meaningful heading structure

Use exactly one primary `<h1>`.

Do not add fake social-preview images.

## Accessibility

Ensure:

* Semantic header, main, sections, and footer
* Correct heading order
* Visible keyboard focus
* Sufficient color contrast
* Navigation links work without JavaScript
* Buttons and links use correct semantic elements
* Decorative visuals are hidden from assistive technology
* Meaningful visuals have accessible labels
* Mobile menu is keyboard accessible
* Reduced-motion preferences are respected
* No autoplay video
* No flashing content

## Performance

Prefer a Server Component.

Avoid unnecessary client-side state.

Do not:

* Fetch tenant data
* Load large images
* Add a carousel dependency
* Add an animation dependency
* Add a UI framework
* Create unnecessary API endpoints

Use existing fonts and styling.

Keep the landing page fast and statically renderable where practical.

Optional authentication detection may make it dynamic; that is acceptable if implemented safely.

## Important constraints

* Do not modify Prisma schema.
* Do not create migrations.
* Do not change authentication business logic.
* Do not weaken route protection.
* Do not make dashboard APIs public.
* Do not expose user or organization data.
* Do not expose environment variables.
* Do not expose Supabase secret keys.
* Do not fetch real schedules for the preview.
* Do not duplicate the authenticated application shell.
* Do not break Login or Request Access.
* Do not alter platform administration authorization.
* Do not refactor unrelated pages.
* Preserve existing user changes.

## Manual verification

### Guest checks

1. Guest opens `/` successfully.
2. Dashboard sidebar does not appear.
3. Sign In links to `/login`.
4. Request Access links to `/request-access`.
5. Features navigation scrolls correctly.
6. Guest cannot access protected dashboard routes.
7. No authentication error appears.
8. No organization data appears.
9. No operational API is called.

### Authenticated checks

10. Authenticated user can still open `/`.
11. Optional Open Dashboard action works.
12. User without membership can reach `/invitations`.
13. Super Admin platform link appears only if intentionally implemented.
14. Dashboard shell remains correct on protected routes.

### Responsive checks

15. Desktop header and hero display correctly.
16. Mobile navigation works.
17. Feature cards stack correctly.
18. CTA buttons remain usable.
19. No horizontal page overflow.
20. Text remains readable at narrow widths.

### Security checks

21. `/` is public through exact matching only.
22. `/admin/*` remains protected.
23. `/api/admin/*` remains protected.
24. No Supabase secret appears in browser JavaScript.
25. No real user, organization, or operational records appear in page HTML.

## Verification commands

Run:

```bash
npm run lint
npm run build
git diff --check
git status
```

Fix errors introduced by the landing page.

Do not modify unrelated files solely to remove pre-existing warnings.

## Final report

Report:

* Files created
* Files moved
* Files modified
* Public route handling
* Landing-page sections
* Guest CTA behavior
* Authenticated CTA behavior, if implemented
* Responsive behavior
* Accessibility checks
* Security checks
* Lint result
* Build result
* Remaining pre-existing warnings
