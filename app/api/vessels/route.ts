import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageMasterData } from "@/lib/auth/permissions";
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

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) || num < 0 ? null : num;
}

function serializeVessel<T extends { lengthOverall: { toNumber(): number } | null; beam: { toNumber(): number } | null }>(vessel: T) {
  return {
    ...vessel,
    lengthOverall: vessel.lengthOverall?.toNumber() ?? null,
    beam: vessel.beam?.toNumber() ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const type = request.nextUrl.searchParams.get("type");
    const isActiveParam = request.nextUrl.searchParams.get("isActive");

    const isValidType = type && VESSEL_TYPES.includes(type as VesselType);

    const vessels = await prisma.vessel.findMany({
      where: {
        organizationId,
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { imo: { contains: search, mode: "insensitive" } },
                { callSign: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(isValidType ? { type: type as VesselType } : {}),
        ...(isActiveParam === "true"
          ? { isActive: true }
          : isActiveParam === "false"
            ? { isActive: false }
            : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: vessels.map(serializeVessel), count: vessels.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to list vessels:", error);
    return NextResponse.json({ error: "Failed to list vessels" }, { status: 500 });
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
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = typeof body.type === "string" ? body.type : "";

    if (!code) {
      return NextResponse.json({ error: "Vessel code is required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Vessel name is required" }, { status: 400 });
    }

    if (!VESSEL_TYPES.includes(type as VesselType)) {
      return NextResponse.json({ error: "Invalid vessel type", allowedTypes: VESSEL_TYPES }, { status: 400 });
    }

    const existingVessel = await prisma.vessel.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existingVessel) {
      return NextResponse.json({ error: `Vessel code '${code}' already exists` }, { status: 409 });
    }

    const imo = optionalString(body.imo);

    if (imo) {
      const existingImo = await prisma.vessel.findFirst({
        where: { organizationId, imo },
        select: { id: true },
      });

      if (existingImo) {
        return NextResponse.json({ error: `IMO number '${imo}' already exists` }, { status: 409 });
      }
    }

    const vessel = await prisma.vessel.create({
      data: {
        organizationId,
        code,
        name,
        type: type as VesselType,
        imo,
        callSign: optionalString(body.callSign),
        flag: optionalString(body.flag)?.toUpperCase() ?? null,
        lengthOverall: optionalDecimal(body.lengthOverall),
        beam: optionalDecimal(body.beam),
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      },
    });

    return NextResponse.json({ data: serializeVessel(vessel) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to create vessel:", error);
    return NextResponse.json({ error: "Failed to create vessel" }, { status: 500 });
  }
}
