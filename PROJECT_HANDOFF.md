# Vessel Schedule — Project Handoff

## Tech Stack

* Next.js App Router
* TypeScript
* Prisma
* Supabase
* Vercel
* GitHub feature branch workflow

## Coding Preference

Keep the code simple and beginner-friendly.

Preferred approach:

* Direct route handlers
* Simple validation with `if` statements
* No Zod
* No repository or service layer unless truly needed
* Practical step-by-step instructions
* Avoid overengineering

## Prisma

Generated Prisma client:

```text
generated/prisma/
```

Prisma singleton:

```text
lib/db/prisma.ts
```

Import style:

```ts
import { prisma } from "@/lib/db/prisma";
```

After changing the Prisma schema, run:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name migration_name
npx prisma generate
```

## Completed Modules

### Infrastructure

* Next.js setup
* Prisma setup
* Supabase database
* Vercel deployment
* Health API

Health endpoint:

```text
GET /api/health
```

### Company

Completed:

* Database model
* GET and POST API
* PATCH API
* List UI
* Search and filter
* Create
* Edit
* Active and inactive status

### Port

Completed:

* Database model
* GET and POST API
* PATCH API
* List UI
* Search and filter
* Create
* Edit
* Active and inactive status

### Terminal

Completed:

* Prisma model
* Port relationship
* GET and POST API
* PATCH API
* Terminal UI
* Port dropdown
* Search and status filter
* Create
* Edit
* Active and inactive status

Relationship:

```text
Port
└── Terminal[]
```

Terminal uniqueness:

```prisma
@@unique([portId, code])
```

This allows the same terminal code at different ports but prevents duplicate terminal codes within the same port.

## Current Branch

```text
feature/terminal
```

Check with:

```bash
git branch --show-current
```

## Next Steps

Run final checks:

```bash
npm run lint
npm run build
git status
```

Commit Terminal work:

```bash
git add .
git commit -m "feat(terminal): add terminal management module"
git push
```

Merge into main:

```bash
git checkout main
git pull origin main
git merge feature/terminal
git push origin main
```

Then create the next feature branch after deciding the next module.

## Current Progress

```text
✅ Infrastructure

✅ Company
   ✅ Database
   ✅ API
   ✅ UI
   ✅ Edit
   ✅ Active/Inactive

✅ Port
   ✅ Database
   ✅ API
   ✅ UI
   ✅ Edit
   ✅ Active/Inactive

✅ Terminal
   ✅ Database
   ✅ API
   ✅ UI
   ✅ Edit
   ✅ Active/Inactive
```

## Starting a New Chat

Paste this instruction:

```text
Please read PROJECT_HANDOFF.md and continue the Vessel Schedule project from the current status.

Keep all explanations simple and beginner-friendly. Use direct route handlers and simple validation. Do not introduce Zod, repository layers, or service layers unless necessary.
```
