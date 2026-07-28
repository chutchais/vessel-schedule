import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageMasterData } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import { prisma } from "@/lib/db/prisma";

const COLOR_HEX_PATTERN = /^#[0-9A-F]{6}$/i;

function serializeBerth<T extends { berthLength: { toNumber(): number } }>(berth: T) {
  return {
    ...berth,
    berthLength: berth.berthLength.toNumber(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const terminalId = request.nextUrl.searchParams.get("terminalId")?.trim();
    const isActiveParam = request.nextUrl.searchParams.get("isActive");

    const berths = await prisma.berth.findMany({
      where: {
        organizationId,
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { terminal: { name: { contains: search, mode: "insensitive" } } },
                { terminal: { code: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(terminalId ? { terminalId } : {}),
        ...(isActiveParam === "true"
          ? { isActive: true }
          : isActiveParam === "false"
            ? { isActive: false }
            : {}),
      },
      include: {
        terminal: {
          select: {
            id: true,
            code: true,
            name: true,
            port: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ terminal: { name: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
    });

    return NextResponse.json({ data: berths.map(serializeBerth), count: berths.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to list berths:", error);
    return NextResponse.json({ error: "Failed to list berths" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (!canManageMasterData(currentUser.membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.terminalId || typeof body.terminalId !== "string") {
      return NextResponse.json({ error: "Terminal is required" }, { status: 400 });
    }

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "Berth code is required" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Berth name is required" }, { status: 400 });
    }

    const terminalId = body.terminalId.trim();
    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    const color = typeof body.color === "string" ? body.color.trim().toUpperCase() : "#3B82F6";
    const zeroOriginSideRaw = typeof body.zeroOriginSide === "string" ? body.zeroOriginSide.trim().toLowerCase() : "left";
    const berthLength = Number(body.berthLength);
    const sortOrder = Number(body.sortOrder);

    if (!terminalId) {
      return NextResponse.json({ error: "Terminal is required" }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ error: "Berth code is required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Berth name is required" }, { status: 400 });
    }

    if (!Number.isFinite(berthLength) || berthLength <= 0) {
      return NextResponse.json({ error: "Berth length must be greater than zero" }, { status: 400 });
    }

    if (!COLOR_HEX_PATTERN.test(color)) {
      return NextResponse.json({ error: "Color must match #RRGGBB" }, { status: 400 });
    }

    if (zeroOriginSideRaw !== "left" && zeroOriginSideRaw !== "right") {
      return NextResponse.json({ error: "Zero origin side must be left or right" }, { status: 400 });
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return NextResponse.json({ error: "Sort order must be a non-negative integer" }, { status: 400 });
    }

    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, organizationId },
      select: { id: true },
    });

    if (!terminal) {
      return NextResponse.json({ error: "Terminal not found" }, { status: 404 });
    }

    const existingBerth = await prisma.berth.findFirst({
      where: { organizationId, terminalId, code },
      select: { id: true },
    });

    if (existingBerth) {
      return NextResponse.json({ error: "Berth code already exists for this terminal" }, { status: 409 });
    }

    const berth = await prisma.$transaction(async (tx) => {
      const created = await tx.berth.create({
        data: {
          organizationId,
          terminalId,
          code,
          name,
          berthLength,
          color,
          zeroOriginSide: zeroOriginSideRaw === "right" ? "RIGHT" : "LEFT",
          sortOrder,
          isActive: typeof body.isActive === "boolean" ? body.isActive : true,
        },
        include: {
          terminal: {
            select: {
              id: true,
              code: true,
              name: true,
              port: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId,
        actor: {
          id: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
        },
        action: "CREATE",
        entityType: AUDIT_ENTITY_TYPES.BERTH,
        entityId: created.id,
        entityName: created.name,
        beforeData: null,
        afterData: created,
      });

      return created;
    });

    return NextResponse.json({ data: serializeBerth(berth) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to create berth:", error);
    return NextResponse.json({ error: "Failed to create berth" }, { status: 500 });
  }
}
