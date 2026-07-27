import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { OrganizationRequestsList } from "@/components/admin/organization-requests-list";
import { PageHeader } from "@/components/ui/page-header";

export default async function AdminOrganizationRequestsPage() {
  let currentUser;
  try {
    currentUser = await requireCurrentUser();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?next=/admin/organization-requests");
    }
    throw error;
  }

  if (currentUser.platformRole !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Requests"
        description="Review and approve guest organization requests"
      />
      <OrganizationRequestsList />
    </div>
  );
}
