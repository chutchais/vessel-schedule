import { notFound, redirect } from "next/navigation";
import { SmtpConfigurationManager } from "@/components/admin/smtp-configuration-manager";
import { PageHeader } from "@/components/ui/page-header";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getSmtpConfigurationStatus, smtpConfigurationComplete } from "@/lib/email/invitation-email";
import { isPlatformAdmin } from "@/lib/platform/smtp-authorization";

export default async function PlatformSmtpPage() {
  let currentUser;
  try { currentUser = await requireCurrentUser(); }
  catch (error) { if (error instanceof AuthError) redirect("/login?next=/platform-administration/smtp"); throw error; }
  if (!isPlatformAdmin(currentUser.platformRole)) notFound();
  return <div className="space-y-6"><PageHeader title="SMTP Configuration" description="Check the server-side FlowPort SMTP configuration and send a restricted diagnostic email." /><SmtpConfigurationManager configuration={getSmtpConfigurationStatus()} complete={smtpConfigurationComplete()} destination={currentUser.email} /></div>;
}
