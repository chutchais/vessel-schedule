import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canViewAuditLogs } from "@/lib/auth/permissions";
import { AuditLogManager } from "@/components/audit-logs/audit-log-manager";

async function getPageAccess() {
  const currentUser = await requireCurrentUser();
  return currentUser.membership.role;
}

export default async function AuditLogsPage() {
  let role: "OWNER" | "ADMIN" | "PLANNER" | "VIEWER";
  try {
    role = await getPageAccess();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?next=/audit-logs");
    }
    throw error;
  }

  if (!canViewAuditLogs(role)) {
    redirect("/");
  }

  return (
    <Suspense fallback={null}>
      <AuditLogManager />
    </Suspense>
  );
}
