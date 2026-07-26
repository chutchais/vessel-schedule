import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function optionalCoordinate(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    return null;
  }

  return coordinate;
}

function serializePort<
  T extends {
    latitude: { toNumber(): number } | null;
    longitude: { toNumber(): number } | null;
  },
>(port: T) {
  return {
    ...port,
    latitude: port.latitude?.toNumber() ?? null,
    longitude: port.longitude?.toNumber() ?? null,
  };
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingPort = await prisma.port.findUnique({
      where: {
        id,
      },
    });

    if (!existingPort) {
      return NextResponse.json(
        { error: "Port not found" },
        { status: 404 },
      );
    }

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

    if (
      !body.country ||
      typeof body.country !== "string"
    ) {
      return NextResponse.json(
        { error: "Country is required" },
        { status: 400 },
      );
    }

    if (
      !body.timezone ||
      typeof body.timezone !== "string"
    ) {
      return NextResponse.json(
        { error: "Timezone is required" },
        { status: 400 },
      );
    }

    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    const country = body.country.trim();
    const timezone = body.timezone.trim();

    const unlocode =
      typeof body.unlocode === "string" &&
      body.unlocode.trim()
        ? body.unlocode.trim().toUpperCase()
        : null;

    const latitude = optionalCoordinate(body.latitude);
    const longitude = optionalCoordinate(body.longitude);

    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return NextResponse.json(
        { error: "Latitude must be between -90 and 90" },
        { status: 400 },
      );
    }

    if (
      longitude !== null &&
      (longitude < -180 || longitude > 180)
    ) {
      return NextResponse.json(
        { error: "Longitude must be between -180 and 180" },
        { status: 400 },
      );
    }

    const duplicatePort = await prisma.port.findFirst({
      where: {
        id: {
          not: id,
        },
        OR: [
          {
            code,
          },
          ...(unlocode
            ? [
                {
                  unlocode,
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        code: true,
        unlocode: true,
      },
    });

    if (duplicatePort) {
      const duplicateField =
        duplicatePort.code === code
          ? "Port code"
          : "UN/LOCODE";

      return NextResponse.json(
        { error: `${duplicateField} already exists` },
        { status: 409 },
      );
    }

    const port = await prisma.port.update({
      where: {
        id,
      },
      data: {
        code,
        unlocode,
        name,
        country,
        timezone,
        latitude,
        longitude,
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : existingPort.isActive,
      },
    });

    return NextResponse.json({
      data: serializePort(port),
    });
  } catch (error) {
    console.error("Failed to update port:", error);

    return NextResponse.json(
      { error: "Failed to update port" },
      { status: 500 },
    );
  }
}