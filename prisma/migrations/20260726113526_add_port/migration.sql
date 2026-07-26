-- CreateTable
CREATE TABLE "ports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(10) NOT NULL,
    "unlocode" VARCHAR(5),
    "name" VARCHAR(200) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ports_code_key" ON "ports"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ports_unlocode_key" ON "ports"("unlocode");

-- CreateIndex
CREATE INDEX "ports_name_idx" ON "ports"("name");

-- CreateIndex
CREATE INDEX "ports_country_idx" ON "ports"("country");
