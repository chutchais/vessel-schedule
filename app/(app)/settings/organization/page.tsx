import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { OrganizationVesselLabelSettings } from "@/components/settings/organization-vessel-label-settings";

async function getPageProps() {
  const currentUser = await requireCurrentUser();
  return { role: currentUser.membership.role };
}

export default async function OrganizationSettingsPage() {
  let props: { role: string };
  try {
    props = await getPageProps();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?next=/settings/organization");
    }
    throw error;
  }

  if (props.role !== "OWNER" && props.role !== "ADMIN") {
    redirect("/");
  }

  return <OrganizationVesselLabelSettings />;
}
