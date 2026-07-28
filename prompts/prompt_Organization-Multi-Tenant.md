# Prompt 1 of 5 — Organization and Multi-Tenant Database Foundation

Implement the database foundation for organization-based multi-tenancy in this Vessel Schedule project.

This prompt covers only:

1. Organization model
2. User profile model
3. Organization membership model
4. Organization ownership of operational data
5. Safe migration and backfill of existing data
6. Tenant-specific unique constraints

Do not implement these yet:

* Login or logout
* Supabase Auth clients
* Guest request page
* Organization approval UI
* Member invitation UI
* Role-protected pages
* Audit Log
* API tenant filtering
* Berth Planner

Those will be implemented in later prompts.

## Project context

The project uses:

* Next.js App Router
* TypeScript
* Prisma
* PostgreSQL/Supabase
* Tailwind CSS

Existing modules include:

* Company
* Port
* Terminal
* Berth
* Vessel
* Service
* VesselSchedule

Important distinction:

```text
Organization = customer account that owns application data
Company      = operational company such as a shipping line, agent,
               terminal operator, or port authority
```

Do not use the existing `Company` model as the tenant.

Before modifying code:

* Inspect `prisma/schema.prisma`.
* Inspect every existing Prisma migration.
* Run `npx prisma migrate status`.
* Check whether the previous Berth/VesselSchedule migration-order problem is resolved.
* Inspect current relationships and unique constraints.
* Inspect the Service-to-Company relationship.
* Preserve all existing fields and working relationships.
* Do not reset or drop the database.
* Do not delete migration folders.
* Do not modify an already-applied migration.
* Stop and report if migration history is broken or inconsistent.

Keep the implementation simple and beginner-friendly.

## 1. Add enums

Add:

```prisma
enum PlatformRole {
  USER
  SUPER_ADMIN
}

enum OrganizationRole {
  OWNER
  ADMIN
  PLANNER
  VIEWER
}
```

`PlatformRole` controls platform-wide capabilities.

`OrganizationRole` controls permissions inside one organization.

A normal organization Owner is not automatically a platform `SUPER_ADMIN`.

## 2. Add Organization

Add:

```prisma
model Organization {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  name     String  @db.VarChar(200)
  slug     String  @unique @db.VarChar(100)
  isActive Boolean @default(true)

  members OrganizationMember[]

  companies       Company[]
  ports           Port[]
  terminals       Terminal[]
  berths          Berth[]
  vessels         Vessel[]
  services        Service[]
  vesselSchedules VesselSchedule[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
  @@map("organizations")
}
```

Use the exact existing model name for Vessel Schedule if it differs.

## 3. Add application User profile

Add:

```prisma
model User {
  id String @id @db.Uuid
  // This ID will later match Supabase Auth auth.users.id.

  email       String @unique @db.VarChar(255)
  displayName String @db.VarChar(200)

  platformRole PlatformRole @default(USER)
  isActive    Boolean      @default(true)

  memberships OrganizationMember[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([platformRole])
  @@index([isActive])
  @@map("users")
}
```

Do not add password, token, session, or authentication-secret fields.

Do not attempt to create a foreign key into the Supabase `auth` schema through Prisma in this prompt.

## 4. Add OrganizationMember

Add:

```prisma
model OrganizationMember {
  organizationId String       @db.Uuid
  organization   Organization @relation(
    fields: [organizationId],
    references: [id],
    onDelete: Cascade
  )

  userId String @db.Uuid
  user   User   @relation(
    fields: [userId],
    references: [id],
    onDelete: Cascade
  )

  role     OrganizationRole
  isActive Boolean          @default(true)

  joinedAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@id([organizationId, userId])
  @@index([userId])
  @@index([organizationId, role])
  @@index([organizationId, isActive])
  @@map("organization_members")
}
```

The membership table is required even if users initially belong to only one organization. It supports future invitations and multiple organization memberships.

Do not create users or memberships in this prompt unless an existing authenticated user profile already exists and can be mapped safely.

## 5. Add organization ownership

Add the following relationship to every tenant-owned operational model:

```prisma
organizationId String       @db.Uuid
organization   Organization @relation(
  fields: [organizationId],
  references: [id],
  onDelete: Restrict
)
```

Add it to:

```text
Company
Port
Terminal
Berth
Vessel
Service
VesselSchedule
```

Add this index to each model:

```prisma
@@index([organizationId])
```

Preserve existing parent-child relationships:

```text
Port → Terminal → Berth
Service → Company
VesselSchedule → Service
VesselSchedule → Vessel
VesselSchedule → Terminal
VesselSchedule → Berth
```

Do not remove or replace these relationships.

## 6. Clarify Service company relationship

The current Service company relationship means the shipping line that operates the service. Rename the Prisma field for clarity:

```prisma
operatorCompanyId String  @db.Uuid
operatorCompany   Company @relation(
  fields: [operatorCompanyId],
  references: [id]
)
```

Also keep:

```prisma
organizationId String
organization   Organization
```

The meanings are:

```text
organizationId    = customer organization that owns this record
operatorCompanyId = shipping-line Company operating the service
```

Preserve existing Service-to-Company data.

If the current database column is named `companyId`, do not drop it and create an empty replacement.

Use one of these safe approaches:

* Map the clearer Prisma field to the current column using `@map("companyId")`, or
* Customize the migration SQL to rename the column using PostgreSQL `ALTER TABLE ... RENAME COLUMN`.

Do not allow Prisma to drop a populated `companyId` column.

Update the reverse Company relation to use a clear name such as:

```prisma
operatedServices Service[]
```

Adapt explicit relation names if Prisma requires them.

## 7. Tenant-specific unique constraints

Review existing global unique constraints.

Codes belonging to independent organizations should generally be unique within an organization, not globally.

Change appropriate constraints to composite constraints.

### Company

Replace global Company code uniqueness with:

```prisma
@@unique([organizationId, code])
```

### Port

Replace global Port code uniqueness with:

```prisma
@@unique([organizationId, code])
```

If UN/LOCODE is currently unique, decide whether it is intentionally global. Prefer organization-specific uniqueness for independently managed tenant data:

```prisma
@@unique([organizationId, unlocode])
```

PostgreSQL permits multiple null values in a unique constraint.

### Terminal

Use:

```prisma
@@unique([organizationId, portId, code])
```

### Berth

Use:

```prisma
@@unique([organizationId, terminalId, code])
```

### Vessel

Use tenant-specific IMO uniqueness unless the project explicitly documents global uniqueness:

```prisma
@@unique([organizationId, imoNumber])
```

If call sign is unique, make it tenant-specific:

```prisma
@@unique([organizationId, callSign])
```

### Service

Use:

```prisma
@@unique([organizationId, code])
```

Do not remove useful existing indexes.

Do not create duplicate indexes already covered by composite unique constraints unless they serve a documented query pattern.

## 8. Existing-data migration strategy

Existing records do not have `organizationId`, so a normal generated migration that immediately adds a required column may fail.

Create a safe customized migration.

Use:

```bash
npx prisma migrate dev --name add_organization_tenancy --create-only
```

Review and customize the generated `migration.sql` before applying it.

The migration must perform operations in this order:

1. Create enums.
2. Create `organizations`.
3. Create `users`.
4. Create `organization_members`.
5. Insert one default organization for existing data.
6. Add nullable `organizationId` columns to existing tables.
7. Backfill all existing rows using the default organization ID.
8. Verify no `organizationId` values remain null.
9. Change each `organizationId` column to `NOT NULL`.
10. Add foreign keys.
11. Replace global unique constraints with tenant-specific constraints.
12. Rename or safely map Service’s current `companyId`.
13. Add indexes.

Use a stable UUID for the default organization so the backfill is deterministic, for example:

```text
00000000-0000-4000-8000-000000000001
```

Insert:

```text
name: Default Organization
slug: default
isActive: true
```

Use the actual quoted column names produced by the existing Prisma schema.

Do not assume table or column names without inspecting the schema and existing migrations.

Before changing a column to `NOT NULL`, include a PostgreSQL guard that fails clearly if backfill did not succeed.

Do not use:

```bash
prisma migrate reset
```

Do not use:

```bash
prisma db push
```

Do not delete existing records.

Do not silently accept destructive migration warnings.

## 9. Relationship consistency review

After the migration, verify that existing related records all have the same organization:

* Terminal organization matches its Port organization.
* Berth organization matches its Terminal organization.
* Service organization matches its operator Company organization.
* VesselSchedule organization matches its Service organization.
* VesselSchedule organization matches its Vessel organization.
* VesselSchedule organization matches its Terminal organization.
* If assigned, VesselSchedule organization matches its Berth organization.

For this prompt, report inconsistent records if any exist.

Do not automatically move records between organizations.

API-level enforcement will be implemented in Prompt 2.

## 10. Generated Prisma client

After applying the migration, regenerate Prisma Client:

```bash
npx prisma generate
```

Update TypeScript types only where required to make the project compile.

Because API tenant enforcement is deferred to Prompt 2, do not make partial security claims. Clearly report that APIs are not yet tenant-secure until Prompt 2 is completed.

## 11. Verification

Run:

```bash
npx prisma format
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run lint
npm run build
git diff --check
git status
```

Also verify through read-only database queries:

* Default organization exists.
* Every Company has `organizationId`.
* Every Port has `organizationId`.
* Every Terminal has `organizationId`.
* Every Berth has `organizationId`.
* Every Vessel has `organizationId`.
* Every Service has `organizationId`.
* Every VesselSchedule has `organizationId`.
* Existing record counts did not decrease.
* Existing Service operator-company relationships remain intact.
* Migration history is healthy.

## Important stop conditions

Stop and report instead of guessing if:

* Prisma migration history is already broken.
* The Berth migration is still missing or incorrectly ordered.
* The VesselSchedule migration still fails in the shadow database.
* An existing migration has already been modified after deployment.
* Existing tables contain inconsistent parent-child organization ownership.
* The Service company relation cannot be preserved without data loss.
* Prisma proposes dropping a populated table or column.
* Applying the migration would require resetting the database.
* Production data ownership cannot be determined safely.

## Final report

Report:

* Files modified
* Migration folder created
* Default organization ID and slug
* Tables receiving `organizationId`
* Unique constraints changed
* Service relationship changes
* Existing record counts before and after
* Relationship consistency results
* Prisma validation result
* Migration status
* Lint result
* Build result
* Any pre-existing warnings
* Any manual action still required

Stop after Prompt 1 is complete. Do not begin authentication, request approval, invitations, permissions, or Audit Log.
