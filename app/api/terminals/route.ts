import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageMasterData } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    const terminals = await prisma.terminal.findMany({
      where: { organizationId },
      include: {
        port: {
          select: {
            id: true,
            code: true,
            name: true,
            timezone: true,
          },
        },
      },
      orderBy: [
        { port: { name: "asc" } },
        { code: "asc" },
      ],
    });

    return NextResponse.json({ data: terminals });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to load terminals:", error);
    return NextResponse.json({ error: "Failed to load terminals" }, { status: 500 });
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

    if (!body.portId || typeof body.portId !== "string") {
      return NextResponse.json({ error: "Port is required" }, { status: 400 });
    }

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "Terminal code is required" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Terminal name is required" }, { status: 400 });
    }

    const portId = body.portId.trim();
    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();

    if (!portId) {
      return NextResponse.json({ error: "Port is required" }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ error: "Terminal code is required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Terminal name is required" }, { status: 400 });
    }

    const port = await prisma.port.findFirst({
      where: { id: portId, organizationId },
      select: { id: true, isActive: true },
    });

    if (!port) {
      return NextResponse.json({ error: "Port not found" }, { status: 404 });
    }

    const existingTerminal = await prisma.terminal.findFirst({
      where: { organizationId, portId, code },
      select: { id: true },
    });

    if (existingTerminal) {
      return NextResponse.json({ error: "Terminal code already exists for this port" }, { status: 409 });
    }

    const terminal = await prisma.$transaction(async (tx) => {
      const created = await tx.terminal.create({
        data: {
          organizationId,
          portId,
          code,
          name,
          isActive: typeof body.isActive === "boolean" ? body.isActive : true,
        },
        include: {
          port: {
            select: {
              id: true,
              code: true,
              name: true,
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
        entityType: AUDIT_ENTITY_TYPES.TERMINAL,
        entityId: created.id,
        entityName: created.name,
        beforeData: null,
        afterData: created,
      });

      return created;
    });

    return NextResponse.json({ data: terminal }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to create terminal:", error);
    return NextResponse.json({ error: "Failed to create terminal" }, { status: 500 });
  }
}
