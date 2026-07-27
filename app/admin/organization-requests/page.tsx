import { requireCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { OrganizationRequestsList } from "@/components/admin/organization-requests-list";

export default async function AdminOrganizationRequestsPage() {
  const currentUser = await requireCurrentUser();

  if (currentUser.platformRole !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Organization Requests</h1>
        <p className="text-gray-600 mt-2">
          Review and approve guest organization requests
        </p>
      </div>

      <OrganizationRequestsList />
    </div>
  );
}
