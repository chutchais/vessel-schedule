Implement a complete **Service management module** for this Vessel Schedule project.

The project uses:

* Next.js App Router
* TypeScript
* Prisma
* PostgreSQL/Supabase
* Tailwind CSS

Before writing code, inspect the existing Company, Port, Terminal, Vessel, and Berth modules. Follow their current folder structure, API response format, component structure, naming conventions, and UI style.

Keep the code simple and beginner-friendly:

* Use direct Next.js route handlers.
* Use simple `if` statement validation.
* Do not use Zod.
* Do not create repository or service layers.
* Import Prisma with:

```ts
import { prisma } from "@/lib/db/prisma";
```

* Do not modify unrelated modules.

## Prisma model

Add this model to `prisma/schema.prisma`:

```prisma
model Service {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  code        String  @unique @db.VarChar(30)
  name        String  @db.VarChar(200)
  description String?
  color       String  @default("#3B82F6") @db.VarChar(7)

  companyId String  @db.Uuid
  company   Company @relation(fields: [companyId], references: [id])

  isActive Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name])
  @@index([companyId])
  @@index([isActive])
  @@map("services")
}
```

Add this reverse relationship inside the existing `Company` model:

```prisma
services Service[]
```

A Service belongs to one Company. Its company must have the type `SHIPPING_LINE`.

After updating the schema, create a migration:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name add_service
npx prisma generate
```

## API routes

Create these route handlers:

```text
GET  /api/services
POST /api/services
PATCH /api/services/[id]
```

Use these files:

```text
app/api/services/route.ts
app/api/services/[id]/route.ts
```

### GET `/api/services`

Return all services.

Include the related company with:

```ts
company: {
  select: {
    id: true,
    code: true,
    name: true,
    type: true,
    isActive: true,
  },
}
```

Sort services by `code` ascending.

Return:

```json
{
  "data": []
}
```

### POST `/api/services`

Validate:

* `companyId` is required and must be a non-empty string.
* The company must exist.
* The company type must be `SHIPPING_LINE`.
* The company must be active.
* `code` is required and must be a non-empty string.
* Trim and convert `code` to uppercase.
* Service code must be unique.
* `name` is required and must be a non-empty string.
* Trim `name`.
* `description` is optional.
* Trim `description` and convert an empty value to `null`.
* `color` is required.
* Convert color to uppercase.
* Color must match `#RRGGBB`.
* `isActive` defaults to `true`.

Use this regular expression for color validation:

```ts
/^#[0-9A-F]{6}$/
```

Return HTTP `201` after successful creation.

### PATCH `/api/services/[id]`

Validate:

* The service must exist.
* Apply the same field validation as POST.
* The selected company must exist.
* The selected company must have type `SHIPPING_LINE`.
* Allow the service’s currently selected company while editing even if it has become inactive.
* If changing to another company, the new company must be active.
* Check service-code uniqueness while excluding the current service ID.
* Preserve the existing active status if `isActive` is not a boolean.

### API status codes

Use:

* `400` for invalid input
* `404` for missing company or service
* `409` when the service code already exists
* `500` for unexpected errors

Use this response format:

```json
{
  "data": {}
}
```

or:

```json
{
  "error": "Clear error message"
}
```

Wrap database operations in `try/catch` and log unexpected errors with `console.error`.

## Service management UI

Create:

```text
app/services/page.tsx
components/services/service-manager.tsx
```

The page component should render `ServiceManager`.

The manager must support:

* Load services
* Load companies
* Create service
* Edit service
* Cancel editing
* Activate/deactivate service
* Search
* Status filter
* Shipping-line filter
* Loading state
* Saving state
* Success messages
* Error messages

### Service form

Include:

* Shipping line dropdown
* Service code
* Service name
* Description
* Color picker
* Hex color input
* Active checkbox
* Create/Update button
* Cancel Edit button while editing

Load companies from:

```text
GET /api/companies
```

Only include companies whose type is:

```text
SHIPPING_LINE
```

When creating, only active shipping lines should be selectable.

When editing, also show the service’s currently selected shipping line if it has become inactive.

The color picker and hex text input must update the same form value.

The default color is:

```text
#3B82F6
```

### Search and filters

Search should match:

* Service code
* Service name
* Description
* Company code
* Company name

Add:

* Status filter: All, Active, Inactive
* Shipping-line filter: All shipping lines or a specific company

Filtering can happen on the client using `useMemo`, consistent with the existing modules.

### Service table

Display these columns:

* Color
* Service code
* Service name
* Shipping line
* Description
* Status
* Actions

Display the color as a small colored square or circle and show the hex value.

Actions:

* Edit
* Activate or Deactivate

Use the same styling pattern as the existing management pages.

## Final verification

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm run lint
npm run build
git status
```

Fix every error introduced by the Service module.

Do not modify unrelated code only to remove existing warnings.

At the end, report:

* Files created
* Files modified
* Migration name
* Validation rules implemented
* Prisma validation result
* Lint result
* Build result
