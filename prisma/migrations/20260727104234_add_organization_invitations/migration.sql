-- CreateEnum
CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED', 'DECLINED');

-- CreateEnum
CREATE TYPE "InvitationDeliveryStatus" AS ENUM ('NOT_ATTEMPTED', 'SENT', 'EXISTING_ACCOUNT', 'FAILED');

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(200),
    "role" "OrganizationRole" NOT NULL,
    "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryStatus" "InvitationDeliveryStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
    "pendingKey" VARCHAR(300),
    "authUserId" UUID,
    "invitedById" UUID NOT NULL,
    "acceptedById" UUID,
    "invitationSentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deliveryError" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_pendingKey_key" ON "organization_invitations"("pendingKey");

-- CreateIndex
CREATE INDEX "organization_invitations_organizationId_idx" ON "organization_invitations"("organizationId");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");

-- CreateIndex
CREATE INDEX "organization_invitations_status_idx" ON "organization_invitations"("status");

-- CreateIndex
CREATE INDEX "organization_invitations_expiresAt_idx" ON "organization_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "organization_invitations_invitedById_idx" ON "organization_invitations"("invitedById");

-- CreateIndex
CREATE INDEX "organization_invitations_acceptedById_idx" ON "organization_invitations"("acceptedById");

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
