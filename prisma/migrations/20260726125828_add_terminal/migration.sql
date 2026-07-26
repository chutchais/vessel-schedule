-- CreateTable
CREATE TABLE "terminals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "portId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terminals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terminals_portId_idx" ON "terminals"("portId");

-- CreateIndex
CREATE INDEX "terminals_name_idx" ON "terminals"("name");

-- CreateIndex
CREATE UNIQUE INDEX "terminals_portId_code_key" ON "terminals"("portId", "code");

-- AddForeignKey
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_portId_fkey" FOREIGN KEY ("portId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
