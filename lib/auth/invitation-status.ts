export type InvitationState = "ACTIVE" | "EXPIRED" | "REVOKED" | "DECLINED" | "ACCEPTED";

export function getInvitationState(
  invitation: {
    status?: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED" | "DECLINED";
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  },
  now = new Date(),
): InvitationState {
  if (invitation.status === "ACCEPTED" || invitation.acceptedAt) return "ACCEPTED";
  if (invitation.status === "DECLINED") return "DECLINED";
  if (invitation.status === "REVOKED" || invitation.revokedAt) return "REVOKED";
  if (invitation.status === "EXPIRED") return "EXPIRED";
  if (invitation.expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}

export function isActiveInvitation(
  invitation: {
    status?: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED" | "DECLINED";
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  },
  now = new Date(),
) {
  return getInvitationState(invitation, now) === "ACTIVE";
}
