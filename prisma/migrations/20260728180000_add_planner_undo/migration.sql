CREATE TABLE "planner_undos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "originalAuditLogId" UUID NOT NULL,
    "beforeData" JSONB NOT NULL,
    "expectedUpdatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planner_undos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planner_undos_organizationId_id_idx" ON "planner_undos"("organizationId", "id");
CREATE INDEX "planner_undos_scheduleId_idx" ON "planner_undos"("scheduleId");
CREATE INDEX "planner_undos_expiresAt_idx" ON "planner_undos"("expiresAt");

ALTER TABLE "planner_undos" ADD CONSTRAINT "planner_undos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planner_undos" ADD CONSTRAINT "planner_undos_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "vessel_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
