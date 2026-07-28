import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageMasterData } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (!canManageMasterData(currentUser.membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingTerminal = await prisma.terminal.findFirst({
      where: { id, organizationId },
      select: { id: true, portId: true, isActive: true },
    });

    if (!existingTerminal) {
      return NextResponse.json({ error: "Terminal not found" }, { status: 404 });
    }

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

    if (!port.isActive && port.id !== existingTerminal.portId) {
      return NextResponse.json({ error: "Cannot move terminal to an inactive port" }, { status: 400 });
    }

    const duplicateTerminal = await prisma.terminal.findFirst({
      where: {
        organizationId,
        portId,
        code,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicateTerminal) {
      return NextResponse.json({ error: "Terminal code already exists for this port" }, { status: 409 });
    }

    const terminal = await prisma.$transaction(async (tx) => {
      const beforeTerminal = await tx.terminal.findFirst({
        where: { id, organizationId },
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

      if (!beforeTerminal) {
        throw new Error("Terminal not found during update");
      }

      const updated = await tx.terminal.update({
        where: { id },
        data: {
          portId,
          code,
          name,
          isActive: typeof body.isActive === "boolean" ? body.isActive : existingTerminal.isActive,
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

      const action =
        beforeTerminal.isActive !== updated.isActive
          ? updated.isActive
            ? "ACTIVATE"
            : "DEACTIVATE"
          : "UPDATE";

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId,
        actor: {
          id: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
        },
        action,
        entityType: AUDIT_ENTITY_TYPES.TERMINAL,
        entityId: updated.id,
        entityName: updated.name,
        beforeData: beforeTerminal,
        afterData: updated,
      });

      return updated;
    });

    return NextResponse.json({ data: terminal });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to update terminal:", error);
    return NextResponse.json({ error: "Failed to update terminal" }, { status: 500 });
  }
}
