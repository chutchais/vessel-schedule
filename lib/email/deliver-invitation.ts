import { createAuditLog } from "@/lib/audit/create-audit-log";
import { prisma } from "@/lib/db/prisma";
import { deliverInvitationEmail } from "@/lib/email/invitation-email";

type DeliveryInput = {
  invitationId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  role: string;
  expiresAt: Date;
  invitationUrl: string;
  actor: { id: string; email: string; displayName: string };
};

// The URL is intentionally only used while composing the message; it is never persisted or audited.
export async function deliverInvitation(input: DeliveryInput) {
  const attemptedAt = new Date();
  const result = await deliverInvitationEmail({ to: input.email, organizationName: input.organizationName, inviterName: input.inviterName, role: input.role, expiresAt: input.expiresAt, acceptanceUrl: input.invitationUrl });
  if (result.ok) {
    await prisma.organizationInvitation.updateMany({
      where: { id: input.invitationId, organizationId: input.organizationId, status: "PENDING", acceptedAt: null, revokedAt: null },
      data: { deliveryStatus: "SENT", deliveryAttemptedAt: attemptedAt, invitationSentAt: attemptedAt, deliveryError: null, deliveryFailureCategory: null },
    });
    return result;
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.organizationInvitation.updateMany({
      where: { id: input.invitationId, organizationId: input.organizationId, status: "PENDING", acceptedAt: null, revokedAt: null },
      data: { deliveryStatus: "FAILED", deliveryAttemptedAt: attemptedAt, deliveryError: result.message, deliveryFailureCategory: result.category },
    });
    if (updated.count) await createAuditLog(tx, { scope: "ORGANIZATION", organizationId: input.organizationId, actor: input.actor, action: "INVITATION_DELIVERY_FAILED", entityType: "OrganizationInvitation", entityId: input.invitationId, entityName: input.email, metadata: { failureCategory: result.category } });
  });
  return result;
}
