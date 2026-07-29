-- CreateEnum
CREATE TYPE "OrganizationApprovalStage" AS ENUM (
    'CLAIMED',
    'ORGANIZATION_LINKED',
    'AUTH_INVITATION_PENDING',
    'AUTH_IDENTITY_LINKED'
);

-- AlterTable
ALTER TABLE "organization_requests"
ADD COLUMN "approvalClaimId" UUID,
ADD COLUMN "approvalClaimedAt" TIMESTAMP(3),
ADD COLUMN "approvalVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "approvalStage" "OrganizationApprovalStage";

-- CreateIndex
CREATE INDEX "organization_requests_approvalClaimedAt_idx"
ON "organization_requests"("approvalClaimedAt");
