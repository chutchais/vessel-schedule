import { prisma } from "@/lib/db/prisma";
import { smtpRateLimitAllowed, smtpRateLimitBucket, type SmtpAction } from "./smtp-security";

const WINDOW_MS = 60 * 60 * 1000;
export async function checkPlatformSmtpRateLimit(action: SmtpAction, userId: string) {
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const resetAt = new Date(windowStart + WINDOW_MS);
  const bucket = await prisma.publicRateLimitBucket.upsert({
    where: { id: smtpRateLimitBucket(action, userId, windowStart) },
    create: { id: smtpRateLimitBucket(action, userId, windowStart), count: 1, resetAt },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  return {
    allowed: smtpRateLimitAllowed(action, bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
  };
}
