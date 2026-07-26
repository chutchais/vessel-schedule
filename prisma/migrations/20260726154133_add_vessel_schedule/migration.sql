-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'ARRIVED', 'BERTHED', 'DEPARTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "vessel_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vesselId" UUID NOT NULL,
    "terminalId" UUID NOT NULL,
    "berthId" UUID,
    "voyageNumber" VARCHAR(50),
    "eta" TIMESTAMP(3) NOT NULL,
    "etb" TIMESTAMP(3),
    "etd" TIMESTAMP(3) NOT NULL,
    "ata" TIMESTAMP(3),
    "atb" TIMESTAMP(3),
    "atd" TIMESTAMP(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PLANNED',
    "remarks" TEXT,
    "berthPositionMeters" INTEGER,
    "headingReverse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessel_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vessel_schedules_vesselId_idx" ON "vessel_schedules"("vesselId");

-- CreateIndex
CREATE INDEX "vessel_schedules_terminalId_idx" ON "vessel_schedules"("terminalId");

-- CreateIndex
CREATE INDEX "vessel_schedules_berthId_idx" ON "vessel_schedules"("berthId");

-- CreateIndex
CREATE INDEX "vessel_schedules_eta_idx" ON "vessel_schedules"("eta");

-- CreateIndex
CREATE INDEX "vessel_schedules_etd_idx" ON "vessel_schedules"("etd");

-- CreateIndex
CREATE INDEX "vessel_schedules_status_idx" ON "vessel_schedules"("status");

-- AddForeignKey
ALTER TABLE "vessel_schedules" ADD CONSTRAINT "vessel_schedules_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_schedules" ADD CONSTRAINT "vessel_schedules_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_schedules" ADD CONSTRAINT "vessel_schedules_berthId_fkey" FOREIGN KEY ("berthId") REFERENCES "berths"("id") ON DELETE SET NULL ON UPDATE CASCADE;
