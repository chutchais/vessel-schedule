import { redirect } from "next/navigation";
import { hashInvitationToken } from "@/lib/auth/invitation-links";
import { prisma } from "@/lib/db/prisma";
import { InvitationRegistration } from "@/components/invitations/invitation-registration";

export default async function InvitationRegisterPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token || token.length < 20) redirect("/request-access");
  const invitation = await prisma.organizationInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) }, select: { email: true, status: true, acceptedAt: true, revokedAt: true, expiresAt: true, organization: { select: { isActive: true } } } });
  if (!invitation || invitation.status !== "PENDING" || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date() || !invitation.organization.isActive) redirect(`/invitations/accept?token=${encodeURIComponent(token)}`);
  const accountExists = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
  if (accountExists) redirect(`/login?next=${encodeURIComponent(`/invitations/accept?token=${encodeURIComponent(token)}`)}`);
  return <InvitationRegistration token={token} email={invitation.email} />;
}
