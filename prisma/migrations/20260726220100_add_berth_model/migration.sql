-- CreateEnum
CREATE TYPE "ZeroOriginSide" AS ENUM ('LEFT', 'RIGHT');

-- CreateTable
CREATE TABLE "berths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "terminalId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "berthLength" DECIMAL(8, 2) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    "zeroOriginSide" "ZeroOriginSide" NOT NULL DEFAULT 'LEFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "berths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "berths_terminalId_code_key" ON "berths"("terminalId", "code");

-- CreateIndex
CREATE INDEX "berths_terminalId_idx" ON "berths"("terminalId");

-- CreateIndex
CREATE INDEX "berths_name_idx" ON "berths"("name");

-- CreateIndex
CREATE INDEX "berths_sortOrder_idx" ON "berths"("sortOrder");

-- CreateIndex
CREATE INDEX "berths_isActive_idx" ON "berths"("isActive");

-- AddForeignKey
ALTER TABLE "berths" ADD CONSTRAINT "berths_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
