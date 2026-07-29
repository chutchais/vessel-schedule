export type InvitationState = "ACTIVE" | "EXPIRED" | "REVOKED" | "ACCEPTED";

export function getInvitationState(
  invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): InvitationState {
  if (invitation.acceptedAt) return "ACCEPTED";
  if (invitation.revokedAt) return "REVOKED";
  if (invitation.expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}

export function isActiveInvitation(invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()) {
  return getInvitationState(invitation, now) === "ACTIVE";
}
