import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { SCHEDULE_STATUSES, type OperationalFilters } from "./operational-filters";
import { toLocalMidnight } from "./timezone";
import type { PlannerDomain } from "./types";
import type { VesselLabelConfig } from "./vessel-label";

export const SHARE_COOKIE_NAME = "berth_planner_share_session";
export const SHARE_SESSION_SECONDS = 30 * 60;
export const PUBLIC_VESSEL_LABEL_CONFIG: VesselLabelConfig = {
  schemaVersion: 1,
  lines: [
    { template: "{{vesselName}}", fontWeight: "BOLD", fontSize: "AUTO", textAlign: "CENTER", textColor: "AUTO" },
    { template: "{{serviceName}} {{voyageNumber}}", fontWeight: "REGULAR", fontSize: "AUTO", textAlign: "CENTER", textColor: "AUTO" },
    { template: "{{eta}} – {{etd}}", fontWeight: "REGULAR", fontSize: "AUTO", textAlign: "CENTER", textColor: "AUTO" },
  ],
};

export function sharingEnabled() {
  return process.env.PUBLIC_PLANNER_SHARING_ENABLED === "true";
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSecret() {
  const secret = randomBytes(32).toString("base64url");
  return { secret, hash: hashToken(secret) };
}

export function createPublicId() {
  return randomBytes(16).toString("base64url");
}

export function tokenMatches(token: string, storedHash: string) {
  const candidate = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function buildShareUrl(origin: string, publicId: string, secret: string) {
  return `${origin}/shared/berth-planner/${encodeURIComponent(publicId)}#${secret}`;
}

function parseDateOnly(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = value.split("-").map(Number);
  const check = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
  return check.toISOString().slice(0, 10) === value ? parts as [number, number, number] : null;
}

export function parseShareDateRange(startValue: unknown, endValue: unknown, timezone: string) {
  const start = parseDateOnly(startValue);
  const end = parseDateOnly(endValue);
  if (!start || !end) return { ok: false as const, error: "Start and end dates must use YYYY-MM-DD." };
  const startOrdinal = Date.UTC(start[0], start[1] - 1, start[2]);
  const endOrdinal = Date.UTC(end[0], end[1] - 1, end[2]);
  const days = Math.round((endOrdinal - startOrdinal) / 86_400_000) + 1;
  if (days < 1 || days > 31) return { ok: false as const, error: "Shared range must be between 1 and 31 days." };
  const afterEnd = new Date(endOrdinal + 86_400_000);
  return {
    ok: true as const,
    startDate: startValue as string,
    endDate: endValue as string,
    rangeStart: toLocalMidnight(start[0], start[1], start[2], timezone),
    rangeEnd: toLocalMidnight(afterEnd.getUTCFullYear(), afterEnd.getUTCMonth() + 1, afterEnd.getUTCDate(), timezone),
  };
}

export function validateShareFilters(value: unknown, allowedBerthIds: Set<string>) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const search = typeof input.search === "string" ? input.search.trim().slice(0, 100) : "";
  const service = typeof input.service === "string" ? input.service.trim().slice(0, 100) : "";
  if (input.status !== undefined && input.status !== "" && (typeof input.status !== "string" || !SCHEDULE_STATUSES.includes(input.status as never))) return { ok: false as const, error: "Invalid schedule status filter." };
  if (["conflictsOnly", "invalidOnly"].some((key) => input[key] !== undefined && typeof input[key] !== "boolean")) return { ok: false as const, error: "Invalid planner filter." };
  const status = typeof input.status === "string" && SCHEDULE_STATUSES.includes(input.status as never) ? input.status as OperationalFilters["status"] : "";
  const berthId = typeof input.berthId === "string" && allowedBerthIds.has(input.berthId) ? input.berthId : "";
  if (input.berthId && !berthId) return { ok: false as const, error: "Selected berth does not belong to the terminal." };
  const filters: OperationalFilters = {
    search, service, status, berthId,
    conflictsOnly: input.conflictsOnly === true,
    invalidOnly: input.invalidOnly === true,
  };
  return { ok: true as const, filters };
}

export function validateView(value: unknown): PlannerDomain | null {
  return value === "position" || value === "datetime" ? value : null;
}

export function publicOpaqueId(publicId: string, kind: string, id: string) {
  return createHash("sha256").update(`${publicId}:${kind}:${id}`).digest("base64url").slice(0, 18);
}

export function publicSecurityHeaders() {
  return {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

export function trustedClientAddress(request: NextRequest) {
  const hops = Number(process.env.PUBLIC_PLANNER_TRUSTED_PROXY_HOPS ?? "0");
  if (!Number.isInteger(hops) || hops < 1) return "untrusted-proxy";
  const values = (request.headers.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return values[Math.max(0, values.length - hops)]?.slice(0, 100) ?? "unknown";
}

export async function checkPublicRateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = hashToken(`${scope}:${identity}:${windowStart}`);
  const resetAt = new Date(windowStart + windowMs);
  const bucket = await prisma.publicRateLimitBucket.upsert({
    where: { id },
    create: { id, count: 1, resetAt },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)) };
}
