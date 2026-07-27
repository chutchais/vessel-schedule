import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { PlatformAuditLogManager } from "@/components/admin/platform-audit-log-manager";

export default async function PlatformAuditLogsPage() {
  const currentUser = await requireCurrentUser();

  if (currentUser.platformRole !== "SUPER_ADMIN") {
    redirect("/");
  }

  return <PlatformAuditLogManager />;
}
