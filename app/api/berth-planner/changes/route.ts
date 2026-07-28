import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import {
  actionFromAudit,
  eventIsRelevant,
  getChangedFields,
  isRecord,
  scheduleSnapshotForEvent,
  type PlannerChangeEvent,
} from "@/lib/berth-planner/realtime";

const MAX_RANGE_MS = 8 * 24 * 60 * 60 * 1000;
const MAX_CURSOR_LENGTH = 512;
const INITIAL_LIMIT = 50;
const POLL_BATCH_SIZE = 200;

type Cursor = { createdAt: string; id: string };

function decodeCursor(value: string | null): Cursor | null {
  if (!value || value.length > MAX_CURSOR_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    return typeof parsed.id === "string" && typeof parsed.createdAt === "string" && !Number.isNaN(new Date(parsed.createdAt).getTime())
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function encodeCursor(value: Cursor | undefined): string | null {
  return value ? Buffer.from(JSON.stringify(value)).toString("base64url") : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;
    const params = request.nextUrl.searchParams;
    const terminalId = params.get("terminalId")?.trim();
    const start = new Date(params.get("startDate") ?? "");
    const end = new Date(params.get("endDate") ?? "");
    const cursorParam = params.get("cursor");
    const cursor = decodeCursor(cursorParam);

    if (!terminalId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > MAX_RANGE_MS) {
      return NextResponse.json({ error: "terminalId and a valid planner date range are required" }, { status: 400 });
    }
    if (cursorParam && !cursor) return NextResponse.json({ error: "Invalid change cursor" }, { status: 400 });

    const terminal = await prisma.terminal.findFirst({ where: { id: terminalId, organizationId }, select: { id: true } });
    if (!terminal) return NextResponse.json({ error: "Terminal not found" }, { status: 404 });

    const where = {
      scope: "ORGANIZATION" as const,
      organizationId,
      entityType: AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE,
      ...(cursor ? {
        OR: [
          { createdAt: { gt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
        ],
      } : {}),
    };
    const records = await prisma.auditLog.findMany({
      where,
      select: { id: true, action: true, entityId: true, entityName: true, actorUserId: true, actorDisplayName: true, beforeData: true, afterData: true, metadata: true, createdAt: true },
      orderBy: [{ createdAt: cursor ? "asc" : "desc" }, { id: cursor ? "asc" : "desc" }],
      take: cursor ? POLL_BATCH_SIZE : INITIAL_LIMIT,
    });
    const ordered = cursor ? records : [...records].reverse();
    const events: PlannerChangeEvent[] = [];
    for (const record of ordered) {
      const action = actionFromAudit({ action: record.action, metadata: record.metadata });
      if (!action || !eventIsRelevant({ beforeData: record.beforeData, afterData: record.afterData, terminalId, start, end })) continue;
      const snapshot = scheduleSnapshotForEvent(record.beforeData, record.afterData);
      const vessel = isRecord(snapshot.vessel) ? snapshot.vessel : null;
      events.push({
        id: record.id,
        scheduleId: record.entityId,
        action,
        createdAt: record.createdAt.toISOString(),
        vesselName: getString(vessel?.name) ?? record.entityName ?? "Schedule",
        voyageNumber: getString(snapshot.voyageNumber),
        actorName: record.actorDisplayName ?? "Another user",
        isCurrentUser: record.actorUserId === currentUser.id,
        changedFields: getChangedFields(record.beforeData, record.afterData),
        terminalId: getString(snapshot.terminalId),
        eta: getString(snapshot.eta),
        etd: getString(snapshot.etd),
        isVisibleInWeek: action !== "deleted" && eventIsRelevant({ beforeData: {}, afterData: record.afterData, terminalId, start, end }),
      });
    }
    const last = ordered.at(-1);
    return NextResponse.json({
      data: events,
      cursor: encodeCursor(last ? { id: last.id, createdAt: last.createdAt.toISOString() } : cursor ?? undefined),
      hasMore: Boolean(cursor && records.length === POLL_BATCH_SIZE),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("Failed to load berth planner changes:", error);
    return NextResponse.json({ error: "Failed to load planner changes" }, { status: 500 });
  }
}
