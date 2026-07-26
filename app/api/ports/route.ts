import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type CreatePortBody = {
  code?: unknown;
  unlocode?: unknown;
  name?: unknown;
  country?: unknown;
  timezone?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  isActive?: unknown;
};

function requiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function optionalCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate =
    typeof value === "number" ? value : Number(value);

  return Number.isFinite(coordinate) ? coordinate : null;
}

function serializePort<T extends {
  latitude: { toNumber(): number } | null;
  longitude: { toNumber(): number } | null;
}>(port: T) {
  return {
    ...port,
    latitude: port.latitude?.toNumber() ?? null,
    longitude: port.longitude?.toNumber() ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const country = request.nextUrl.searchParams.get("country")?.trim();
    const isActiveParam =
      request.nextUrl.searchParams.get("isActive");

    const ports = await prisma.port.findMany({
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
                  unlocode: {
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
              ],
            }
          : {}),
        ...(country
          ? {
              country: {
                equals: country,
                mode: "insensitive",
              },
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
      data: ports.map(serializePort),
      count: ports.length,
    });
  } catch (error) {
    console.error("Failed to list ports:", error);

    return NextResponse.json(
      { error: "Failed to list ports" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { error: "Port code is required" },
        { status: 400 },
      );
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Port name is required" },
        { status: 400 },
      );
    }

    if (!body.country || typeof body.country !== "string") {
      return NextResponse.json(
        { error: "Country is required" },
        { status: 400 },
      );
    }

    if (!body.timezone || typeof body.timezone !== "string") {
      return NextResponse.json(
        { error: "Timezone is required" },
        { status: 400 },
      );
    }

    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    const country = body.country.trim();
    const timezone = body.timezone.trim();

    const existingPort = await prisma.port.findUnique({
      where: {
        code,
      },
    });

    if (existingPort) {
      return NextResponse.json(
        { error: "Port code already exists" },
        { status: 409 },
      );
    }

    const port = await prisma.port.create({
      data: {
        code,
        name,
        country,
        timezone,
        unlocode: body.unlocode
          ? body.unlocode.trim().toUpperCase()
          : null,
        latitude:
          body.latitude === "" || body.latitude == null
            ? null
            : Number(body.latitude),
        longitude:
          body.longitude === "" || body.longitude == null
            ? null
            : Number(body.longitude),
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : true,
      },
    });

    return NextResponse.json(
      { data: port },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create port:", error);

    return NextResponse.json(
      { error: "Failed to create port" },
      { status: 500 },
    );
  }
}