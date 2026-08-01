import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageOrgMembers } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  defaultExportTableConfig,
  isMissingExportTableConfigColumn,
  normalizeStoredExportTableConfig,
  validateExportTableConfigInput,
} from "@/lib/berth-planner/export-table-config";

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (!canManageOrgMembers(currentUser.membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    let organization: { id: string; exportTableConfig: unknown } | null = null;
    try {
      organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, exportTableConfig: true },
      });
    } catch (error) {
      if (!isMissingExportTableConfigColumn(error)) throw error;
      return NextResponse.json({
        data: defaultExportTableConfig(),
        persistence: "local-only" as const,
      });
    }

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: normalizeStoredExportTableConfig(organization.exportTableConfig),
      persistence: "database" as const,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to get export table settings:", error);
    return NextResponse.json({ error: "Failed to load export table settings" }, { status: 500 });
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
    const validation = validateExportTableConfigInput(body.config);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let updated: { exportTableConfig: unknown };
    try {
      updated = await prisma.organization.update({
        where: { id: organizationId },
        data: { exportTableConfig: validation.config },
        select: { exportTableConfig: true },
      });
    } catch (error) {
      if (isMissingExportTableConfigColumn(error)) {
        return NextResponse.json({
          data: validation.config,
          persistence: "local-only" as const,
          warning: "Database is not migrated for export table settings yet.",
        });
      }
      throw error;
    }

    return NextResponse.json({
      data: normalizeStoredExportTableConfig(updated.exportTableConfig),
      persistence: "database" as const,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to update export table settings:", error);
    return NextResponse.json({ error: "Failed to update export table settings" }, { status: 500 });
  }
}
