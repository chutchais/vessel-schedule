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

function optionalCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function serializePort<T extends { latitude: { toNumber(): number } | null; longitude: { toNumber(): number } | null }>(port: T) {
  return {
    ...port,
    latitude: port.latitude?.toNumber() ?? null,
    longitude: port.longitude?.toNumber() ?? null,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (!canManageMasterData(currentUser.membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingPort = await prisma.port.findFirst({
      where: { id, organizationId },
    });

    if (!existingPort) {
      return NextResponse.json({ error: "Port not found" }, { status: 404 });
    }

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "Port code is required" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Port name is required" }, { status: 400 });
    }

    if (!body.country || typeof body.country !== "string") {
      return NextResponse.json({ error: "Country is required" }, { status: 400 });
    }

    if (!body.timezone || typeof body.timezone !== "string") {
      return NextResponse.json({ error: "Timezone is required" }, { status: 400 });
    }

    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    const country = body.country.trim();
    const timezone = body.timezone.trim();
    const unlocode = typeof body.unlocode === "string" && body.unlocode.trim() ? body.unlocode.trim().toUpperCase() : null;
    const latitude = optionalCoordinate(body.latitude);
    const longitude = optionalCoordinate(body.longitude);

    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return NextResponse.json({ error: "Latitude must be between -90 and 90" }, { status: 400 });
    }

    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return NextResponse.json({ error: "Longitude must be between -180 and 180" }, { status: 400 });
    }

    const duplicatePort = await prisma.port.findFirst({
      where: {
        organizationId,
        id: { not: id },
        OR: [{ code }, ...(unlocode ? [{ unlocode }] : [])],
      },
      select: { id: true, code: true, unlocode: true },
    });

    if (duplicatePort) {
      const duplicateField = duplicatePort.code === code ? "Port code" : "UN/LOCODE";
      return NextResponse.json({ error: `${duplicateField} already exists` }, { status: 409 });
    }

    const port = await prisma.$transaction(async (tx) => {
      const beforePort = await tx.port.findFirst({
        where: { id, organizationId },
      });

      if (!beforePort) {
        throw new Error("Port not found during update");
      }

      const updated = await tx.port.update({
        where: { id },
        data: {
          code,
          unlocode,
          name,
          country,
          timezone,
          latitude,
          longitude,
          isActive: typeof body.isActive === "boolean" ? body.isActive : existingPort.isActive,
        },
      });

      const action =
        beforePort.isActive !== updated.isActive
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
        entityType: AUDIT_ENTITY_TYPES.PORT,
        entityId: updated.id,
        entityName: updated.name,
        beforeData: beforePort,
        afterData: updated,
      });

      return updated;
    });

    return NextResponse.json({ data: serializePort(port) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to update port:", error);
    return NextResponse.json({ error: "Failed to update port" }, { status: 500 });
  }
}
