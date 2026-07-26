-- CreateEnum
CREATE TYPE "VesselType" AS ENUM ('CONTAINER_SHIP', 'BULK_CARRIER', 'TANKER', 'GENERAL_CARGO', 'RO_RO', 'OTHER');

-- CreateTable
CREATE TABLE "vessels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "imo" VARCHAR(10),
    "callSign" VARCHAR(10),
    "flag" VARCHAR(3),
    "type" "VesselType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vessels_code_key" ON "vessels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vessels_imo_key" ON "vessels"("imo");

-- CreateIndex
CREATE INDEX "vessels_name_idx" ON "vessels"("name");

-- CreateIndex
CREATE INDEX "vessels_type_idx" ON "vessels"("type");

-- CreateIndex
CREATE INDEX "vessels_isActive_idx" ON "vessels"("isActive");
