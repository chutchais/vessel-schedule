import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageMasterData } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { prisma } from "@/lib/db/prisma";

const VESSEL_TYPES = [
  "CONTAINER_SHIP",
  "BULK_CARRIER",
  "TANKER",
  "GENERAL_CARGO",
  "RO_RO",
  "OTHER",
] as const;

type VesselType = (typeof VESSEL_TYPES)[number];

type RouteContext = {
  params: Promise<{ id: string }>;
};

function serializeVessel<T extends { lengthOverall: { toNumber(): number } | null; beam: { toNumber(): number } | null }>(vessel: T) {
  return {
    ...vessel,
    lengthOverall: vessel.lengthOverall?.toNumber() ?? null,
    beam: vessel.beam?.toNumber() ?? null,
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

    const existingVessel = await prisma.vessel.findFirst({ where: { id, organizationId } });

    if (!existingVessel) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }

    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!code) {
      return NextResponse.json({ error: "Vessel code is required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Vessel name is required" }, { status: 400 });
    }

    const duplicateCode = await prisma.vessel.findFirst({
      where: { code, id: { not: id } },
      select: { id: true },
    });

    if (duplicateCode) {
      return NextResponse.json({ error: "Vessel code already exists" }, { status: 409 });
    }

    const imo = typeof body.imo === "string" && body.imo.trim() ? body.imo.trim() : null;

    if (imo) {
      const duplicateImo = await prisma.vessel.findFirst({
        where: { organizationId, imo, id: { not: id } },
        select: { id: true },
      });

      if (duplicateImo) {
        return NextResponse.json({ error: "IMO number already exists" }, { status: 409 });
      }
    }

    const type =
      typeof body.type === "string" && VESSEL_TYPES.includes(body.type as VesselType)
        ? (body.type as VesselType)
        : existingVessel.type;

    const vessel = await prisma.$transaction(async (tx) => {
      const beforeVessel = await tx.vessel.findFirst({
        where: { id, organizationId },
      });

      if (!beforeVessel) {
        throw new Error("Vessel not found during update");
      }

      const updated = await tx.vessel.update({
        where: { id },
        data: {
          code,
          name,
          type,
          imo,
          callSign: typeof body.callSign === "string" && body.callSign.trim() ? body.callSign.trim() : null,
          flag: typeof body.flag === "string" && body.flag.trim() ? body.flag.trim().toUpperCase() : null,
          lengthOverall:
            body.lengthOverall !== undefined && body.lengthOverall !== ""
              ? Number(body.lengthOverall) >= 0
                ? Number(body.lengthOverall)
                : null
              : null,
          beam:
            body.beam !== undefined && body.beam !== ""
              ? Number(body.beam) >= 0
                ? Number(body.beam)
                : null
              : null,
          isActive: typeof body.isActive === "boolean" ? body.isActive : existingVessel.isActive,
        },
      });

      const action =
        beforeVessel.isActive !== updated.isActive
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
        entityType: "Vessel",
        entityId: updated.id,
        entityName: updated.name,
        beforeData: beforeVessel,
        afterData: updated,
      });

      return updated;
    });

    return NextResponse.json({ data: serializeVessel(vessel) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to update vessel:", error);
    return NextResponse.json({ error: "Failed to update vessel" }, { status: 500 });
  }
}
