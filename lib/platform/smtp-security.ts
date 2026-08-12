import { createHash } from "node:crypto";

export type SmtpAction = "check" | "send-test";
const SMTP_ACTION_LIMITS: Record<SmtpAction, number> = { check: 10, "send-test": 3 };

export function safeSmtpErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (/timed?\s*out/i.test(raw)) return "The SMTP server did not respond in time.";
  if (/auth|credential|login|535|authentication/i.test(raw)) return "SMTP authentication was rejected.";
  if (/certificate|tls|ssl|handshake/i.test(raw)) return "The SMTP TLS connection could not be established.";
  return "The SMTP provider could not complete the request.";
}

export function smtpRateLimitBucket(action: SmtpAction, userId: string, windowStart: number) {
  return createHash("sha256").update(`platform-smtp:${action}:${userId}:${windowStart}`).digest("hex");
}

export function smtpRateLimitAllowed(action: SmtpAction, count: number) {
  return count <= SMTP_ACTION_LIMITS[action];
}

export function csrfOriginAllowed(origin: string | null, referer: string | null, applicationOrigin: string) {
  if (origin) return origin === applicationOrigin;
  if (!referer) return false;
  try {
    return new URL(referer).origin === applicationOrigin;
  } catch {
    return false;
  }
}

export function isAllowedSmtpAction(value: unknown): value is SmtpAction {
  return value === "check" || value === "send-test";
}

export function canSendSmtpTestToVerifiedAccount(authEmail: string | undefined, emailConfirmedAt: string | undefined, currentUserEmail: string) {
  return Boolean(authEmail && emailConfirmedAt && authEmail.toLowerCase() === currentUserEmail.toLowerCase());
}
