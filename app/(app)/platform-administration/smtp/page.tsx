import { notFound, redirect } from "next/navigation";
import { SmtpConfigurationManager } from "@/components/admin/smtp-configuration-manager";
import { PageHeader } from "@/components/ui/page-header";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { inspectSmtpConfiguration } from "@/lib/email/invitation-email";
import { isPlatformAdmin } from "@/lib/platform/smtp-authorization";

export default async function PlatformSmtpPage() {
  let currentUser;
  try { currentUser = await requireCurrentUser(); }
  catch (error) { if (error instanceof AuthError) redirect("/login?next=/platform-administration/smtp"); throw error; }
  if (!isPlatformAdmin(currentUser.platformRole)) notFound();
  const configuration = inspectSmtpConfiguration();
  return <div className="space-y-6"><PageHeader title="SMTP Configuration" description="Check the server-side FlowPort SMTP configuration and send a restricted diagnostic email." /><SmtpConfigurationManager configuration={configuration.entries} complete={configuration.complete} destination={currentUser.email} /></div>;
}
