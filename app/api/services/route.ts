import { NextRequest, NextResponse } from "next/server";
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
    const services = await prisma.service.findMany({
      include: {
        company: {
          select: serviceCompanySelect,
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    return NextResponse.json({
      data: services,
    });
  } catch (error) {
    console.error("Failed to load services:", error);

    return NextResponse.json(
      {
        error: "Failed to load services",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.companyId || typeof body.companyId !== "string") {
      return NextResponse.json(
        {
          error: "Shipping line is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        {
          error: "Service code is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        {
          error: "Service name is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.color || typeof body.color !== "string") {
      return NextResponse.json(
        {
          error: "Color is required",
        },
        {
          status: 400,
        },
      );
    }

    const companyId = body.companyId.trim();
    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";
    const color = body.color.trim().toUpperCase();

    if (!companyId) {
      return NextResponse.json(
        {
          error: "Shipping line is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          error: "Service code is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          error: "Service name is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!color || !COLOR_HEX_PATTERN.test(color)) {
      return NextResponse.json(
        {
          error: "Color must match #RRGGBB",
        },
        {
          status: 400,
        },
      );
    }

    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        id: true,
        type: true,
        isActive: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          error: "Shipping line not found",
        },
        {
          status: 404,
        },
      );
    }

    if (company.type !== "SHIPPING_LINE") {
      return NextResponse.json(
        {
          error: "Selected company must be a shipping line",
        },
        {
          status: 400,
        },
      );
    }

    if (!company.isActive) {
      return NextResponse.json(
        {
          error: "Selected shipping line is inactive",
        },
        {
          status: 400,
        },
      );
    }

    const existingService = await prisma.service.findUnique({
      where: {
        code,
      },
      select: {
        id: true,
      },
    });

    if (existingService) {
      return NextResponse.json(
        {
          error: "Service code already exists",
        },
        {
          status: 409,
        },
      );
    }

    const service = await prisma.service.create({
      data: {
        companyId,
        code,
        name,
        description: description || null,
        color,
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : true,
      },
      include: {
        company: {
          select: serviceCompanySelect,
        },
      },
    });

    return NextResponse.json(
      {
        data: service,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Failed to create service:", error);

    return NextResponse.json(
      {
        error: "Failed to create service",
      },
      {
        status: 500,
      },
    );
  }
}
