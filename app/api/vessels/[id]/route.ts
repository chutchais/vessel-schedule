import { NextRequest, NextResponse } from "next/server";
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingVessel = await prisma.vessel.findUnique({ where: { id } });

    if (!existingVessel) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }

    const code =
      typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!code) {
      return NextResponse.json(
        { error: "Vessel code is required" },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Vessel name is required" },
        { status: 400 },
      );
    }

    const duplicateCode = await prisma.vessel.findFirst({
      where: { code, id: { not: id } },
      select: { id: true },
    });

    if (duplicateCode) {
      return NextResponse.json(
        { error: "Vessel code already exists" },
        { status: 409 },
      );
    }

    const imo =
      typeof body.imo === "string" && body.imo.trim()
        ? body.imo.trim()
        : null;

    if (imo) {
      const duplicateImo = await prisma.vessel.findFirst({
        where: { imo, id: { not: id } },
        select: { id: true },
      });

      if (duplicateImo) {
        return NextResponse.json(
          { error: "IMO number already exists" },
          { status: 409 },
        );
      }
    }

    const type =
      typeof body.type === "string" &&
      VESSEL_TYPES.includes(body.type as VesselType)
        ? (body.type as VesselType)
        : existingVessel.type;

    const vessel = await prisma.vessel.update({
      where: { id },
      data: {
        code,
        name,
        type,
        imo,
        callSign:
          typeof body.callSign === "string" && body.callSign.trim()
            ? body.callSign.trim()
            : null,
        flag:
          typeof body.flag === "string" && body.flag.trim()
            ? body.flag.trim().toUpperCase()
            : null,
        lengthOverall:
          body.lengthOverall !== undefined && body.lengthOverall !== ""
            ? (Number(body.lengthOverall) >= 0 ? Number(body.lengthOverall) : null)
            : null,
        beam:
          body.beam !== undefined && body.beam !== ""
            ? (Number(body.beam) >= 0 ? Number(body.beam) : null)
            : null,
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : existingVessel.isActive,
      },
    });

    return NextResponse.json({ data: vessel });
  } catch (error) {
    console.error("Failed to update vessel:", error);
    return NextResponse.json(
      { error: "Failed to update vessel" },
      { status: 500 },
    );
  }
}
