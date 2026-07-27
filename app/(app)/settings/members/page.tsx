import { requireCurrentUser } from "@/lib/auth/current-user";
import { AuthError } from "@/lib/auth/auth-errors";
import { redirect } from "next/navigation";
import { MemberManager } from "@/components/settings/member-manager";

async function getPageProps() {
  const currentUser = await requireCurrentUser();
  return { id: currentUser.id, role: currentUser.membership.role };
}

export default async function MembersPage() {
  let props: { id: string; role: string };
  try {
    props = await getPageProps();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?next=/settings/members");
    }
    throw error;
  }

  if (props.role !== "OWNER" && props.role !== "ADMIN") {
    redirect("/");
  }

  return <MemberManager currentUserId={props.id} currentRole={props.role} />;
}
