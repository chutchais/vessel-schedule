import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageOrgMembers } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  defaultVesselLabelConfig,
  normalizeStoredVesselLabelConfig,
  validateVesselLabelConfigInput,
} from "@/lib/berth-planner/vessel-label";

function isMissingVesselLabelConfigColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown; message?: unknown };
  return maybe.code === "P2022"
    && typeof maybe.message === "string"
    && maybe.message.includes("organizations.vesselLabelConfig");
}

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (!canManageOrgMembers(currentUser.membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    let organization: { id: string; vesselLabelConfig: unknown } | null = null;
    try {
      organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          vesselLabelConfig: true,
        },
      });
    } catch (error) {
      if (!isMissingVesselLabelConfigColumn(error)) throw error;
      return NextResponse.json({
        data: defaultVesselLabelConfig(),
        persistence: "local-only" as const,
      });
    }

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { config, migratedFromLegacy } = normalizeStoredVesselLabelConfig(
      organization.vesselLabelConfig,
    );

    if (migratedFromLegacy) {
      await prisma.organization.update({
        where: { id: organization.id },
        data: { vesselLabelConfig: config },
      });
    }

    return NextResponse.json({
      data: config,
      persistence: "database" as const,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to get vessel label settings:", error);
    return NextResponse.json({ error: "Failed to load vessel label settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (!canManageOrgMembers(currentUser.membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json() as { config?: unknown };
    const validation = validateVesselLabelConfigInput(body.config);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let updated: { vesselLabelConfig: unknown };
    try {
      updated = await prisma.organization.update({
        where: { id: organizationId },
        data: { vesselLabelConfig: validation.config },
        select: {
          vesselLabelConfig: true,
        },
      });
    } catch (error) {
      if (isMissingVesselLabelConfigColumn(error)) {
        return NextResponse.json(
          {
            data: validation.config,
            persistence: "local-only" as const,
            warning: "Database is not migrated for vessel label settings yet.",
          },
        );
      }
      throw error;
    }

    const { config } = normalizeStoredVesselLabelConfig(updated.vesselLabelConfig);
    return NextResponse.json({
      data: config,
      persistence: "database" as const,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to update vessel label settings:", error);
    return NextResponse.json({ error: "Failed to update vessel label settings" }, { status: 500 });
  }
}
