-- =============================================================================
-- Migration: add_organization_tenancy
-- Safe multi-step migration:
--   1. Create enums
--   2. Create organizations, users, organization_members tables
--   3. Insert default organization for backfill
--   4. Add nullable organizationId columns to all tenant-owned tables
--   5. Backfill existing rows with the default organization
--   6. Verify no rows were missed (fail loudly if any remain null)
--   7. Alter columns to NOT NULL
--   8. Add foreign key constraints
--   9. Drop old global unique constraints and add tenant-specific ones
--  10. Add new indexes
-- =============================================================================

-- ─── Step 1: Create enums ─────────────────────────────────────────────────────

CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPER_ADMIN');
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'PLANNER', 'VIEWER');

-- ─── Step 2a: Create organizations ───────────────────────────────────────────

CREATE TABLE "organizations" (
    "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"      VARCHAR(200) NOT NULL,
    "slug"      VARCHAR(100) NOT NULL,
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_isActive_idx" ON "organizations"("isActive");

-- ─── Step 2b: Create users ────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id"           UUID         NOT NULL,
    "email"        VARCHAR(255) NOT NULL,
    "displayName"  VARCHAR(200) NOT NULL,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "isActive"     BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_platformRole_idx" ON "users"("platformRole");
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- ─── Step 2c: Create organization_members ────────────────────────────────────

CREATE TABLE "organization_members" (
    "organizationId" UUID              NOT NULL,
    "userId"         UUID              NOT NULL,
    "role"           "OrganizationRole" NOT NULL,
    "isActive"       BOOLEAN           NOT NULL DEFAULT true,
    "joinedAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organizationId", "userId")
);

CREATE INDEX "organization_members_userId_idx"               ON "organization_members"("userId");
CREATE INDEX "organization_members_organizationId_role_idx"  ON "organization_members"("organizationId", "role");
CREATE INDEX "organization_members_organizationId_isActive_idx" ON "organization_members"("organizationId", "isActive");

ALTER TABLE "organization_members"
    ADD CONSTRAINT "organization_members_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_members"
    ADD CONSTRAINT "organization_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Step 3: Insert default organization for existing data ────────────────────
-- Stable UUID so this migration is idempotent on re-run in a restored environment.

INSERT INTO "organizations" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Default Organization',
    'default',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ─── Step 4: Add nullable organizationId columns ──────────────────────────────

ALTER TABLE "companies"       ADD COLUMN "organizationId" UUID;
ALTER TABLE "ports"           ADD COLUMN "organizationId" UUID;
ALTER TABLE "terminals"       ADD COLUMN "organizationId" UUID;
ALTER TABLE "berths"          ADD COLUMN "organizationId" UUID;
ALTER TABLE "vessels"         ADD COLUMN "organizationId" UUID;
ALTER TABLE "services"        ADD COLUMN "organizationId" UUID;
ALTER TABLE "vessel_schedules" ADD COLUMN "organizationId" UUID;

-- ─── Step 5: Backfill all existing rows ───────────────────────────────────────

UPDATE "companies"       SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ports"           SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "terminals"       SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "berths"          SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "vessels"         SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "services"        SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "vessel_schedules" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;

-- ─── Step 6: Verify — fail loudly if any rows were missed ────────────────────

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "companies"       WHERE "organizationId" IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'companies backfill incomplete: % rows still null', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM "ports"           WHERE "organizationId" IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'ports backfill incomplete: % rows still null', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM "terminals"       WHERE "organizationId" IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'terminals backfill incomplete: % rows still null', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM "berths"          WHERE "organizationId" IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'berths backfill incomplete: % rows still null', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM "vessels"         WHERE "organizationId" IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'vessels backfill incomplete: % rows still null', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM "services"        WHERE "organizationId" IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'services backfill incomplete: % rows still null', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM "vessel_schedules" WHERE "organizationId" IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'vessel_schedules backfill incomplete: % rows still null', null_count; END IF;
END $$;

-- ─── Step 7: Alter columns to NOT NULL ───────────────────────────────────────

ALTER TABLE "companies"        ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ports"            ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "terminals"        ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "berths"           ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "vessels"          ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "services"         ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "vessel_schedules" ALTER COLUMN "organizationId" SET NOT NULL;

-- ─── Step 8: Add foreign key constraints ─────────────────────────────────────

ALTER TABLE "companies"
    ADD CONSTRAINT "companies_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ports"
    ADD CONSTRAINT "ports_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "terminals"
    ADD CONSTRAINT "terminals_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "berths"
    ADD CONSTRAINT "berths_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vessels"
    ADD CONSTRAINT "vessels_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "services"
    ADD CONSTRAINT "services_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vessel_schedules"
    ADD CONSTRAINT "vessel_schedules_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Step 9: Replace global unique constraints with tenant-specific ones ──────

-- Company: drop global code uniqueness, add (organizationId, code)
DROP INDEX IF EXISTS "companies_code_key";
CREATE UNIQUE INDEX "companies_organizationId_code_key" ON "companies"("organizationId", "code");

-- Port: drop global code and unlocode uniqueness
DROP INDEX IF EXISTS "ports_code_key";
DROP INDEX IF EXISTS "ports_unlocode_key";
CREATE UNIQUE INDEX "ports_organizationId_code_key"     ON "ports"("organizationId", "code");
CREATE UNIQUE INDEX "ports_organizationId_unlocode_key" ON "ports"("organizationId", "unlocode");

-- Terminal: drop (portId, code), add (organizationId, portId, code)
DROP INDEX IF EXISTS "terminals_portId_code_key";
CREATE UNIQUE INDEX "terminals_organizationId_portId_code_key" ON "terminals"("organizationId", "portId", "code");

-- Berth: drop (terminalId, code), add (organizationId, terminalId, code)
DROP INDEX IF EXISTS "berths_terminalId_code_key";
CREATE UNIQUE INDEX "berths_organizationId_terminalId_code_key" ON "berths"("organizationId", "terminalId", "code");

-- Vessel: drop global imo uniqueness, add (organizationId, imo); keep global code uniqueness
DROP INDEX IF EXISTS "vessels_imo_key";
CREATE UNIQUE INDEX "vessels_organizationId_imo_key" ON "vessels"("organizationId", "imo");

-- Service: drop global code uniqueness, add (organizationId, code)
DROP INDEX IF EXISTS "services_code_key";
CREATE UNIQUE INDEX "services_organizationId_code_key" ON "services"("organizationId", "code");

-- ─── Step 10: Add organizationId indexes ─────────────────────────────────────

CREATE INDEX "companies_organizationId_idx"       ON "companies"("organizationId");
CREATE INDEX "ports_organizationId_idx"            ON "ports"("organizationId");
CREATE INDEX "terminals_organizationId_idx"        ON "terminals"("organizationId");
CREATE INDEX "berths_organizationId_idx"           ON "berths"("organizationId");
CREATE INDEX "vessels_organizationId_idx"          ON "vessels"("organizationId");
CREATE INDEX "services_organizationId_idx"         ON "services"("organizationId");
CREATE INDEX "vessel_schedules_organizationId_idx" ON "vessel_schedules"("organizationId");
