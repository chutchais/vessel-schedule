ALTER TYPE "AuditAction" ADD VALUE 'REVOKE_SHARE';

CREATE TABLE "berth_planner_shares" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "publicId" VARCHAR(32) NOT NULL,
  "secretHash" CHAR(64) NOT NULL,
  "organizationId" UUID NOT NULL,
  "terminalId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "startDate" CHAR(10) NOT NULL,
  "endDate" CHAR(10) NOT NULL,
  "rangeStart" TIMESTAMP(3) NOT NULL,
  "rangeEnd" TIMESTAMP(3) NOT NULL,
  "filters" JSONB,
  "initialView" VARCHAR(16) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "berth_planner_shares_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "berth_planner_share_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shareId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAccessedAt" TIMESTAMP(3),
  CONSTRAINT "berth_planner_share_sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public_rate_limit_buckets" (
  "id" CHAR(64) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "berth_planner_shares_publicId_key" ON "berth_planner_shares"("publicId");
CREATE INDEX "berth_planner_shares_organizationId_createdAt_idx" ON "berth_planner_shares"("organizationId", "createdAt");
CREATE INDEX "berth_planner_shares_terminalId_idx" ON "berth_planner_shares"("terminalId");
CREATE INDEX "berth_planner_shares_expiresAt_idx" ON "berth_planner_shares"("expiresAt");
CREATE UNIQUE INDEX "berth_planner_share_sessions_tokenHash_key" ON "berth_planner_share_sessions"("tokenHash");
CREATE INDEX "berth_planner_share_sessions_shareId_expiresAt_idx" ON "berth_planner_share_sessions"("shareId", "expiresAt");
CREATE INDEX "berth_planner_share_sessions_expiresAt_idx" ON "berth_planner_share_sessions"("expiresAt");
CREATE INDEX "public_rate_limit_buckets_resetAt_idx" ON "public_rate_limit_buckets"("resetAt");
ALTER TABLE "berth_planner_shares" ADD CONSTRAINT "berth_planner_shares_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "berth_planner_shares" ADD CONSTRAINT "berth_planner_shares_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "terminals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "berth_planner_shares" ADD CONSTRAINT "berth_planner_shares_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "berth_planner_share_sessions" ADD CONSTRAINT "berth_planner_share_sessions_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "berth_planner_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
