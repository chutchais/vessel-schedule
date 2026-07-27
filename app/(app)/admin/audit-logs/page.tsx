import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { PlatformAuditLogManager } from "@/components/admin/platform-audit-log-manager";

export default async function PlatformAuditLogsPage() {
  let currentUser;
  try {
    currentUser = await requireCurrentUser();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?next=/admin/audit-logs");
    }
    throw error;
  }

  if (currentUser.platformRole !== "SUPER_ADMIN") {
    redirect("/");
  }

  return <PlatformAuditLogManager />;
}
