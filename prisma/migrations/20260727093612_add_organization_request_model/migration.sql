-- CreateEnum
CREATE TYPE "OrganizationRequestStatus" AS ENUM ('PENDING', 'APPROVING', 'APPROVED', 'REJECTED', 'APPROVAL_FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "organization_members" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "organization_requests" (
    "id" VARCHAR(30) NOT NULL,
    "organizationName" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100),
    "requesterName" VARCHAR(200) NOT NULL,
    "requesterEmail" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "message" TEXT,
    "status" "OrganizationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "organizationId" UUID,
    "authUserId" UUID,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "approvalStartedAt" TIMESTAMP(3),
    "invitationSentAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_requests_status_idx" ON "organization_requests"("status");

-- CreateIndex
CREATE INDEX "organization_requests_requesterEmail_idx" ON "organization_requests"("requesterEmail");

-- CreateIndex
CREATE INDEX "organization_requests_organizationId_idx" ON "organization_requests"("organizationId");

-- CreateIndex
CREATE INDEX "organization_requests_reviewedById_idx" ON "organization_requests"("reviewedById");

-- CreateIndex
CREATE INDEX "organization_requests_createdAt_idx" ON "organization_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
