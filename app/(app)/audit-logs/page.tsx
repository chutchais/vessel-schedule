import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { AuditLogManager } from "@/components/audit-logs/audit-log-manager";

async function getPageAccess() {
  const currentUser = await requireCurrentUser();
  return currentUser.membership.role;
}

export default async function AuditLogsPage() {
  let role: string;
  try {
    role = await getPageAccess();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?next=/audit-logs");
    }
    throw error;
  }

  if (role !== "OWNER" && role !== "ADMIN") {
    redirect("/");
  }

  return <AuditLogManager />;
}
