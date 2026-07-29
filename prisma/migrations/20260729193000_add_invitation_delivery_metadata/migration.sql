-- The NOT_ATTEMPTED enum label was renamed to PENDING during the first attempted
-- deployment of this migration. The remaining statements are safe to apply.
ALTER TYPE "AuditAction" ADD VALUE 'INVITATION_DELIVERY_FAILED';

ALTER TABLE "organization_invitations"
ADD COLUMN "deliveryAttemptedAt" TIMESTAMP(3),
ADD COLUMN "deliveryFailureCategory" VARCHAR(80);
