import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const COMPANY_TYPES = [
  "SHIPPING_LINE",
  "SHIPPING_AGENT",
  "TERMINAL_OPERATOR",
  "PORT_AUTHORITY",
  "OTHER",
] as const;

type CompanyType = (typeof COMPANY_TYPES)[number];

type CreateCompanyBody = {
  code?: unknown;
  name?: unknown;
  shortName?: unknown;
  type?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
  isActive?: unknown;
};

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(request: NextRequest) {
  try {


    const search = request.nextUrl.searchParams.get("search")?.trim();
    const type = request.nextUrl.searchParams.get("type");
    const isActiveParam = request.nextUrl.searchParams.get("isActive");

    const isValidType =
      type && COMPANY_TYPES.includes(type as CompanyType);

    const companies = await prisma.company.findMany({
      where: {
        ...(search
          ? {
              OR: [
                {
                  code: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  shortName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
        ...(isValidType
          ? {
              type: type as CompanyType,
            }
          : {}),
        ...(isActiveParam === "true"
          ? { isActive: true }
          : isActiveParam === "false"
            ? { isActive: false }
            : {}),
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      data: companies,
      count: companies.length,
    });
  } catch (error) {
    console.error("Failed to list companies:", error);

    return NextResponse.json(
      {
        error: "Failed to list companies",
      },
      { status: 500 },
    );
  }
}



export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCompanyBody;

    const code =
      typeof body.code === "string"
        ? body.code.trim().toUpperCase()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const type =
      typeof body.type === "string"
        ? body.type
        : "";

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

    if (!COMPANY_TYPES.includes(type as CompanyType)) {
      return NextResponse.json(
        {
          error: "Invalid company type",
          allowedTypes: COMPANY_TYPES,
        },
        { status: 400 },
      );
    }


    const existingCompany = await prisma.company.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existingCompany) {
      return NextResponse.json(
        {
          error: `Company code '${code}' already exists`,
        },
        { status: 409 },
      );
    }

    const company = await prisma.company.create({
      data: {
        code,
        name,
        shortName: optionalString(body.shortName),
        type: type as CompanyType,
        email: optionalString(body.email),
        phone: optionalString(body.phone),
        address: optionalString(body.address),
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : true,
      },
    });

    return NextResponse.json(
      {
        data: company,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create company:", error);

    return NextResponse.json(
      {
        error: "Failed to create company",
      },
      { status: 500 },
    );
  }
}