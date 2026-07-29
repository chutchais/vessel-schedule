import { InvitationAcceptance } from "@/components/invitations/invitation-acceptance";

export default async function InvitationAcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <InvitationAcceptance token={typeof token === "string" ? token : ""} />;
}
