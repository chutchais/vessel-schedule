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

export type SmtpOriginHeaders = {
  origin: string | null;
  referer: string | null;
  host: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  vercelId: string | null;
};

export type SmtpOriginValidation = {
  allowed: boolean;
  expectedOrigin: string;
  receivedOrigin: string | null;
  receivedRequestOrigin: string | null;
};

function normalizedOrigin(value: string | null) {
  if (!value || value.includes(",")) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function requestOrigin(host: string | null, proto: string | null) {
  if (!host || !proto || host.includes(",") || proto.includes(",")) return null;
  return normalizedOrigin(`${proto}://${host}`);
}

/**
 * Evaluates only normalized origins. Invalid header values are never reflected,
 * and Vercel forwarded headers are considered only when Vercel marks the request.
 */
export function validateSmtpRequestOrigin(headers: SmtpOriginHeaders, applicationOrigin: string): SmtpOriginValidation {
  const expectedOrigin = normalizedOrigin(applicationOrigin);
  if (!expectedOrigin) {
    return { allowed: false, expectedOrigin: "invalid configured origin", receivedOrigin: null, receivedRequestOrigin: null };
  }

  const origin = normalizedOrigin(headers.origin);
  const refererOrigin = normalizedOrigin(headers.referer);
  const hostOrigin = requestOrigin(headers.host, expectedOrigin.startsWith("https:") ? "https" : "http");
  const forwardedOrigin = headers.vercelId ? requestOrigin(headers.forwardedHost, headers.forwardedProto) : null;
  const receivedOrigin = origin ?? refererOrigin;
  const receivedRequestOrigin = forwardedOrigin ?? hostOrigin;

  // A supplied Origin is authoritative. Never fall back to Host/forwarded headers after a mismatch.
  if (headers.origin) return { allowed: origin === expectedOrigin, expectedOrigin, receivedOrigin: origin, receivedRequestOrigin };
  if (headers.referer) return { allowed: refererOrigin === expectedOrigin, expectedOrigin, receivedOrigin: refererOrigin, receivedRequestOrigin };

  return {
    allowed: hostOrigin === expectedOrigin || forwardedOrigin === expectedOrigin,
    expectedOrigin,
    receivedOrigin: null,
    receivedRequestOrigin,
  };
}

export function isAllowedSmtpAction(value: unknown): value is SmtpAction {
  return value === "check" || value === "send-test";
}

export function canSendSmtpTestToVerifiedAccount(authEmail: string | undefined, emailConfirmedAt: string | undefined, currentUserEmail: string) {
  return Boolean(authEmail && emailConfirmedAt && authEmail.toLowerCase() === currentUserEmail.toLowerCase());
}
