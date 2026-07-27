import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageMasterData } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

const COLOR_HEX_PATTERN = /^#[0-9A-F]{6}$/;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const serviceCompanySelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  isActive: true,
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

    const existingService = await prisma.service.findFirst({
      where: { id, organizationId },
      select: { id: true, operatorCompanyId: true, isActive: true },
    });

    if (!existingService) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

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

    const isChangingCompany = existingService.operatorCompanyId !== companyId;

    if (isChangingCompany && !company.isActive) {
      return NextResponse.json({ error: "Cannot move service to an inactive shipping line" }, { status: 400 });
    }

    const duplicateService = await prisma.service.findFirst({
      where: {
        organizationId,
        code,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicateService) {
      return NextResponse.json({ error: "Service code already exists" }, { status: 409 });
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        operatorCompanyId: companyId,
        code,
        name,
        description: description || null,
        color,
        isActive: typeof body.isActive === "boolean" ? body.isActive : existingService.isActive,
      },
      include: {
        operatorCompany: {
          select: serviceCompanySelect,
        },
      },
    });

    return NextResponse.json({ data: service });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to update service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}
