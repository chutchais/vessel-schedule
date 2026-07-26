-- AlterTable
ALTER TABLE "vessel_schedules"
ADD COLUMN "serviceId" UUID;

-- CreateIndex
CREATE INDEX "vessel_schedules_serviceId_idx" ON "vessel_schedules"("serviceId");

-- AddForeignKey
ALTER TABLE "vessel_schedules"
ADD CONSTRAINT "vessel_schedules_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "services"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
