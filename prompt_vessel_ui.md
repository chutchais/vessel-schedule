Refactor the Vessel Schedule project UI into a consistent, scalable application design.

This task is **Phase 1 only**:

1. Create a shared application shell and navigation.
2. Create a small set of reusable UI components.
3. Refactor the Vessel management screen as the reference design.
4. Do not refactor the other management screens yet.
5. Do not change database models, migrations, or API business logic.

The project uses:

* Next.js App Router
* React
* TypeScript
* Tailwind CSS
* Prisma
* Supabase

Before changing code:

* Read the relevant Next.js documentation from `node_modules/next/dist/docs/`.
* Inspect the existing layout, global CSS, and all management screens.
* Inspect the Vessel page, component, and APIs carefully.
* Preserve all existing Vessel features and API request/response shapes.
* Follow the project’s beginner-friendly coding style.
* Do not introduce Zod, repository layers, service layers, or a state-management library.
* Do not install a UI library unless the project already uses one.
* Use straightforward React and Tailwind CSS.

## Design direction

Create a clean maritime operations dashboard with:

* Light neutral background
* White content surfaces
* Slate/gray text
* Blue as the primary action color
* Consistent spacing
* Subtle borders and shadows
* Clear typography hierarchy
* Accessible focus states
* Responsive desktop and mobile layouts

Avoid:

* Excessive gradients
* Excessive rounded cards
* Very large headings
* Random colors between modules
* Form controls with inconsistent heights
* Overly abstract generic components

## Application shell

Create a shared application shell containing:

* Desktop sidebar
* Mobile navigation
* Application name: `Vessel Schedule`
* Main content area
* Active navigation state
* Responsive behavior

Navigation groups:

```text
Master Data
- Companies
- Ports
- Terminals
- Berths
- Vessels
- Services

Operations
- Vessel Schedules
- Berth Planner
```

Use these routes:

```text
/companies
/ports
/terminals
/berths
/vessels
/services
/schedules
/berth-planner
```

If a route does not exist yet, the navigation link may still be included, but it must not cause build errors.

Use a client component for navigation only if required for `usePathname`. Keep the root layout as a server component where possible.

Update metadata to use:

```ts
title: "Vessel Schedule"
description: "Vessel schedule and berth planning system"
```

## Shared UI components

Create a small reusable component collection under:

```text
components/ui/
```

Create only the components needed for this phase:

```text
app-shell.tsx
sidebar-navigation.tsx
mobile-navigation.tsx
page-header.tsx
button.tsx
input.tsx
select.tsx
textarea.tsx
form-field.tsx
drawer.tsx
status-badge.tsx
alert-message.tsx
empty-state.tsx
loading-state.tsx
table-container.tsx
```

Requirements:

* Components must accept `className` where useful.
* Keep component APIs simple.
* Do not build a complicated variant framework.
* Use normal TypeScript props.
* Use accessible labels and semantic HTML.
* Buttons must support primary, secondary, and danger-style actions.
* Form controls must have consistent height, border, padding, focus ring, and disabled state.
* The drawer must support:

  * Open and closed states
  * Title and optional description
  * Close button
  * Backdrop click
  * Escape-key close
  * Prevent background scrolling while open
  * Mobile full-width behavior
  * Desktop right-side panel
  * Accessible dialog attributes
* Do not add animation complexity; a simple transition is enough.
* StatusBadge must support active and inactive states.
* AlertMessage must support success and error messages.

Do not create a highly generic CRUD component or generic data-table engine.

## Refactor Vessel Management

Refactor `/vessels` into a list-first page.

Remove the permanent create/edit form from above the table.

The page layout should be:

```text
Page header
- Title: Vessel Management
- Description: Manage vessel master data
- Primary button: Add Vessel

Filter toolbar
- Search input
- Status filter
- Record count
- Clear filters button when filters are active

Vessel table
- Vessel data
- Status
- Actions

Drawer
- Create or edit form
```

### Page header

Use the shared `PageHeader`.

Display:

* `Vessel Management`
* `Manage vessel master data`
* `Add Vessel` button

Clicking `Add Vessel` must:

* Reset the form
* Clear the editing ID
* Clear old messages
* Open the drawer

### Filters

Keep existing search and active/inactive filtering behavior.

Search should continue matching the currently supported Vessel fields.

Show a record summary such as:

```text
Showing 12 of 20 vessels
```

Provide a `Clear filters` button when search or status filtering is active.

Do not add server-side pagination in this phase. Keep the current client-side data loading and filtering.

### Vessel table

Preserve all existing Vessel columns and data.

Use the shared table container and consistent styling:

* Sticky or visually clear table header
* Comfortable row spacing
* Horizontal scrolling on small screens
* Clear status badges
* Visible hover state
* Consistent action buttons
* Empty state when no records match
* Loading state while loading records

Use a compact actions area with:

* Edit
* Activate or Deactivate

Do not add delete functionality.

### Create/edit drawer

Use the shared `Drawer`.

Drawer title:

```text
Create Vessel
```

or:

```text
Edit Vessel
```

Move the existing Vessel form into the drawer.

Preserve every existing Vessel field, including vessel dimensions and any fields already present in the current project.

Preserve all existing validation behavior.

The drawer footer should contain:

* Cancel
* Create Vessel or Update Vessel

Required behavior:

* Close after a successful create or update.
* Refresh the Vessel list after successful save.
* Keep the drawer open when the API returns an error.
* Show the error inside the drawer.
* Prevent accidental duplicate submissions while saving.
* Disable appropriate controls while saving.
* Reset the form when starting a new create operation.
* Populate the form correctly when editing.
* Ask for confirmation before closing only if the form has unsaved changes.
* Do not close the drawer when clicking the backdrop if there are unsaved changes.
* Do not use `window.confirm` if a simple inline confirmation state can be implemented cleanly; otherwise keep the solution simple.

Display page-level success messages after the drawer closes.

### Activate/deactivate behavior

Preserve the existing PATCH request behavior.

Before changing status, show a small confirmation dialog or accessible confirmation panel:

```text
Deactivate Vessel?
The vessel will no longer be available for new schedules.
```

For activation:

```text
Activate Vessel?
The vessel will become available for new schedules.
```

Do not add deletion.

## Responsive behavior

Desktop:

* Fixed or stable sidebar
* Main content uses available width
* Drawer opens from the right
* Table remains the primary view

Mobile:

* Sidebar becomes mobile navigation
* Page header actions stack appropriately
* Filters stack vertically
* Drawer uses full width
* Table scrolls horizontally
* Buttons remain easy to tap

## Important implementation constraints

* Do not change Vessel API endpoints.
* Do not change Prisma schema or migrations.
* Do not rename existing API fields.
* Do not remove any Vessel functionality.
* Do not refactor Company, Port, Terminal, Berth, Service, or Schedule manager components in this phase.
* The application shell may wrap all routes, but only the Vessel page should receive the new CRUD layout.
* Preserve existing user changes.
* Avoid large unrelated formatting changes.
* Keep components easy for a beginner to understand.
* Do not suppress ESLint rules to hide errors.
* Avoid `any`.
* Handle asynchronous loading safely and avoid state updates after unmounting.

## Verification

After implementation, run:

```bash
npm run lint
npm run build
git diff --check
git status
```

Fix every error introduced by this refactor.

Do not modify unrelated files merely to remove pre-existing warnings.

At the end, report:

* Files created
* Files modified
* Shared components introduced
* Vessel behaviors preserved
* Responsive behavior implemented
* Lint result
* Build result
* Any pre-existing warnings that remain

Stop after completing the application shell, shared UI components, and Vessel reference screen. Do not automatically refactor the other modules.
