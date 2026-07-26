-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    "companyId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");

-- CreateIndex
CREATE INDEX "services_name_idx" ON "services"("name");

-- CreateIndex
CREATE INDEX "services_companyId_idx" ON "services"("companyId");

-- CreateIndex
CREATE INDEX "services_isActive_idx" ON "services"("isActive");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
