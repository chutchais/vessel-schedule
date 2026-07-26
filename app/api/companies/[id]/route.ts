import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingCompany = await prisma.company.findUnique({
      where: {
        id,
      },
    });

    if (!existingCompany) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 },
      );
    }

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { error: "Company code is required" },
        { status: 400 },
      );
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 },
      );
    }

    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();

    if (!code) {
      return NextResponse.json(
        { error: "Company code is required" },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 },
      );
    }

    const duplicateCompany = await prisma.company.findFirst({
      where: {
        code,
        id: {
          not: id,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicateCompany) {
      return NextResponse.json(
        { error: "Company code already exists" },
        { status: 409 },
      );
    }

    const company = await prisma.company.update({
      where: {
        id,
      },
      data: {
        code,
        name,

        shortName:
          typeof body.shortName === "string" &&
          body.shortName.trim()
            ? body.shortName.trim()
            : null,

        type:
          typeof body.type === "string"
            ? body.type
            : existingCompany.type,

        email:
          typeof body.email === "string" &&
          body.email.trim()
            ? body.email.trim()
            : null,

        phone:
          typeof body.phone === "string" &&
          body.phone.trim()
            ? body.phone.trim()
            : null,

        address:
          typeof body.address === "string" &&
          body.address.trim()
            ? body.address.trim()
            : null,

        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : existingCompany.isActive,
      },
    });

    return NextResponse.json({
      data: company,
    });
  } catch (error) {
    console.error("Failed to update company:", error);

    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 },
    );
  }
}