import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageMasterData } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import { formatServiceAuditEntityName } from "@/lib/audit/entity-name";
import { prisma } from "@/lib/db/prisma";

const COLOR_HEX_PATTERN = /^#[0-9A-F]{6}$/;

const serviceCompanySelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  isActive: true,
};

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    const services = await prisma.service.findMany({
      where: { organizationId },
      include: {
        operatorCompany: {
          select: serviceCompanySelect,
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    return NextResponse.json({ data: services });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to load services:");
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
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

    if (!body.companyId || typeof body.companyId !== "string") {
      return NextResponse.json({ error: "Shipping line is required" }, { status: 400 });
    }

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "Service code is required" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    }

    if (!body.color || typeof body.color !== "string") {
      return NextResponse.json({ error: "Color is required" }, { status: 400 });
    }

    const companyId = body.companyId.trim();
    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const color = body.color.trim().toUpperCase();

    if (!companyId) {
      return NextResponse.json({ error: "Shipping line is required" }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ error: "Service code is required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    }

    if (!color || !COLOR_HEX_PATTERN.test(color)) {
      return NextResponse.json({ error: "Color must match #RRGGBB" }, { status: 400 });
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId },
      select: { id: true, type: true, isActive: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Shipping line not found" }, { status: 404 });
    }

    if (company.type !== "SHIPPING_LINE") {
      return NextResponse.json({ error: "Selected company must be a shipping line" }, { status: 400 });
    }

    if (!company.isActive) {
      return NextResponse.json({ error: "Selected shipping line is inactive" }, { status: 400 });
    }

    const existingService = await prisma.service.findFirst({
      where: { organizationId, code },
      select: { id: true },
    });

    if (existingService) {
      return NextResponse.json({ error: "Service code already exists" }, { status: 409 });
    }

    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          operatorCompanyId: companyId,
          organizationId,
          code,
          name,
          description: description || null,
          color,
          isActive: typeof body.isActive === "boolean" ? body.isActive : true,
        },
        include: {
          operatorCompany: {
            select: serviceCompanySelect,
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
        entityType: AUDIT_ENTITY_TYPES.SERVICE,
        entityId: created.id,
        entityName: formatServiceAuditEntityName(created.code, created.name),
        beforeData: null,
        afterData: created,
      });

      return created;
    });

    return NextResponse.json({ data: service }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to create service:");
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
