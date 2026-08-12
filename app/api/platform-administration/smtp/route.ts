import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { getServerAppUrl } from "@/lib/config/app-url";
import { inspectSmtpConfiguration, sendSmtpTestEmail, verifySmtpConnection } from "@/lib/email/invitation-email";
import { checkPlatformSmtpRateLimit } from "@/lib/platform/smtp-rate-limit";
import { isPlatformAdmin } from "@/lib/platform/smtp-authorization";
import { canSendSmtpTestToVerifiedAccount, csrfOriginAllowed, isAllowedSmtpAction, safeSmtpErrorMessage, type SmtpAction } from "@/lib/platform/smtp-security";

const headers = { "Cache-Control": "private, no-store" };

function response(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers });
}

async function auditAttempt(actor: { id: string; email: string; displayName: string }, action: SmtpAction, success: boolean) {
  await prisma.$transaction((tx) => createAuditLog(tx, {
    scope: "PLATFORM",
    actor,
    action: "UPDATE",
    entityType: "PlatformSmtp",
    entityId: action,
    entityName: action === "check" ? "SMTP connection check" : "SMTP test email",
    metadata: { success },
  }));
}

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    if (!isPlatformAdmin(currentUser.platformRole)) return response({ error: "Access denied" }, { status: 403 });
    const configuration = inspectSmtpConfiguration();
    return response({ data: { configuration: configuration.entries, complete: configuration.complete } });
  } catch (error) {
    if (error instanceof AuthError) return response({ error: error.message }, { status: error.statusCode });
    return response({ error: "Unable to read SMTP configuration status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let currentUser: Awaited<ReturnType<typeof requireCurrentUser>>;
  try {
    currentUser = await requireCurrentUser();
  } catch (error) {
    if (error instanceof AuthError) return response({ error: error.message }, { status: error.statusCode });
    return response({ error: "Unable to process SMTP request" }, { status: 500 });
  }

  if (!isPlatformAdmin(currentUser.platformRole)) return response({ error: "Access denied" }, { status: 403 });

  let applicationOrigin: string;
  try { applicationOrigin = getServerAppUrl(); }
  catch { return response({ error: "SMTP diagnostics are unavailable" }, { status: 503 }); }
  if (!csrfOriginAllowed(request.headers.get("origin"), request.headers.get("referer"), applicationOrigin)) {
    return response({ error: "Invalid request origin" }, { status: 403 });
  }

  let body: { action?: unknown };
  try { body = await request.json() as { action?: unknown }; }
  catch { return response({ error: "Invalid request" }, { status: 400 }); }
  if (!isAllowedSmtpAction(body.action)) return response({ error: "Invalid SMTP action" }, { status: 400 });
  const action = body.action;

  let rate;
  try { rate = await checkPlatformSmtpRateLimit(action, currentUser.id); }
  catch { return response({ error: "SMTP diagnostics are temporarily unavailable" }, { status: 503 }); }
  if (!rate.allowed) {
    await auditAttempt(currentUser, action, false);
    return response({ error: "Too many SMTP diagnostic attempts. Try again later.", retryAfterSeconds: rate.retryAfterSeconds }, { status: 429 });
  }

  if (!inspectSmtpConfiguration().complete) {
    await auditAttempt(currentUser, action, false);
    return response({ error: "SMTP configuration is incomplete. Update production environment settings and redeploy before trying again." }, { status: 503 });
  }

  try {
    if (action === "check") {
      const result = await verifySmtpConnection();
      await auditAttempt(currentUser, action, result.ok);
      return result.ok
        ? response({ data: { success: true, message: "SMTP connection and authentication succeeded." } })
        : response({ data: { success: false, message: safeSmtpErrorMessage(result.message) } }, { status: 502 });
    }

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    const verifiedEmail = user?.email;
    if (error || !canSendSmtpTestToVerifiedAccount(verifiedEmail, user?.email_confirmed_at, currentUser.email)) {
      await auditAttempt(currentUser, action, false);
      return response({ error: "A verified signed-in account email is required to send a test email." }, { status: 403 });
    }
    if (!verifiedEmail) {
      await auditAttempt(currentUser, action, false);
      return response({ error: "A verified signed-in account email is required to send a test email." }, { status: 403 });
    }

    const result = await sendSmtpTestEmail({ to: verifiedEmail, environment: process.env.NODE_ENV ?? "unknown", appUrl: applicationOrigin, sentAt: new Date() });
    await auditAttempt(currentUser, action, result.ok);
    return result.ok
      ? response({ data: { success: true, message: "SMTP test email sent to your verified account email.", destination: verifiedEmail } })
      : response({ data: { success: false, message: safeSmtpErrorMessage(result.message) } }, { status: 502 });
  } catch (error) {
    await auditAttempt(currentUser, action, false);
    return response({ data: { success: false, message: safeSmtpErrorMessage(error) } }, { status: 502 });
  }
}
