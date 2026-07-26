import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const SCHEDULE_STATUSES = [
  "PLANNED",
  "CONFIRMED",
  "ARRIVED",
  "BERTHED",
  "DEPARTED",
  "CANCELLED",
] as const;

type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function trimOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function trimOptionalId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function mapSchedule<T extends {
  vessel: {
    id: string;
    imo: string | null;
    name: string;
    callSign: string | null;
  };
}>(schedule: T) {
  return {
    ...schedule,
    vessel: {
      id: schedule.vessel.id,
      imoNumber: schedule.vessel.imo,
      name: schedule.vessel.name,
      callSign: schedule.vessel.callSign,
    },
  };
}

async function hasBerthOverlap(input: {
  berthId: string;
  eta: Date;
  etb: Date | null;
  etd: Date;
  excludeScheduleId: string;
}) {
  const existingSchedules = await prisma.vesselSchedule.findMany({
    where: {
      berthId: input.berthId,
      status: {
        not: "CANCELLED",
      },
      id: {
        not: input.excludeScheduleId,
      },
    },
    select: {
      eta: true,
      etb: true,
      etd: true,
    },
  });

  const newStart = input.etb ?? input.eta;
  const newEnd = input.etd;

  return existingSchedules.some((schedule) => {
    const existingStart = schedule.etb ?? schedule.eta;
    const existingEnd = schedule.etd;

    return (
      newStart < existingEnd &&
      newEnd > existingStart
    );
  });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingSchedule =
      await prisma.vesselSchedule.findUnique({
        where: { id },
        select: {
          id: true,
          vesselId: true,
          terminalId: true,
          berthId: true,
          serviceId: true,
        },
      });

    if (!existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    if (!body.vesselId || typeof body.vesselId !== "string") {
      return NextResponse.json(
        { error: "Vessel is required" },
        { status: 400 },
      );
    }

    if (
      !body.terminalId ||
      typeof body.terminalId !== "string"
    ) {
      return NextResponse.json(
        { error: "Terminal is required" },
        { status: 400 },
      );
    }

    if (!body.eta || typeof body.eta !== "string") {
      return NextResponse.json(
        { error: "ETA is required" },
        { status: 400 },
      );
    }

    if (!body.etd || typeof body.etd !== "string") {
      return NextResponse.json(
        { error: "ETD is required" },
        { status: 400 },
      );
    }

    const vesselId = body.vesselId.trim();
    const terminalId = body.terminalId.trim();
    const berthId = trimOptionalId(body.berthId);
    const serviceId = trimOptionalId(body.serviceId);
    const eta = parseOptionalDate(body.eta);
    const etb = parseOptionalDate(body.etb);
    const etd = parseOptionalDate(body.etd);
    const ata = parseOptionalDate(body.ata);
    const atb = parseOptionalDate(body.atb);
    const atd = parseOptionalDate(body.atd);
    const status =
      typeof body.status === "string"
        ? body.status.trim().toUpperCase()
        : "PLANNED";
    const berthPositionMeters = parseOptionalInteger(
      body.berthPositionMeters,
    );
    const headingReverse =
      typeof body.headingReverse === "boolean"
        ? body.headingReverse
        : false;

    if (!vesselId) {
      return NextResponse.json(
        { error: "Vessel is required" },
        { status: 400 },
      );
    }

    if (!terminalId) {
      return NextResponse.json(
        { error: "Terminal is required" },
        { status: 400 },
      );
    }

    if (!eta) {
      return NextResponse.json(
        { error: "ETA must be a valid date" },
        { status: 400 },
      );
    }

    if (!etd) {
      return NextResponse.json(
        { error: "ETD must be a valid date" },
        { status: 400 },
      );
    }

    if (etd <= eta) {
      return NextResponse.json(
        { error: "ETD must be later than ETA" },
        { status: 400 },
      );
    }

    if (
      body.etb !== undefined &&
      body.etb !== null &&
      body.etb !== "" &&
      !etb
    ) {
      return NextResponse.json(
        { error: "ETB must be a valid date" },
        { status: 400 },
      );
    }

    if (etb && (etb < eta || etb > etd)) {
      return NextResponse.json(
        {
          error:
            "ETB must be between ETA and ETD",
        },
        { status: 400 },
      );
    }

    if (
      body.ata !== undefined &&
      body.ata !== null &&
      body.ata !== "" &&
      !ata
    ) {
      return NextResponse.json(
        { error: "ATA must be a valid date" },
        { status: 400 },
      );
    }

    if (
      body.atb !== undefined &&
      body.atb !== null &&
      body.atb !== "" &&
      !atb
    ) {
      return NextResponse.json(
        { error: "ATB must be a valid date" },
        { status: 400 },
      );
    }

    if (
      body.atd !== undefined &&
      body.atd !== null &&
      body.atd !== "" &&
      !atd
    ) {
      return NextResponse.json(
        { error: "ATD must be a valid date" },
        { status: 400 },
      );
    }

    if (
      !SCHEDULE_STATUSES.includes(
        status as ScheduleStatus,
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid schedule status",
        },
        { status: 400 },
      );
    }

    if (
      body.berthPositionMeters !== undefined &&
      body.berthPositionMeters !== null &&
      body.berthPositionMeters !== "" &&
      berthPositionMeters === null
    ) {
      return NextResponse.json(
        {
          error:
            "Berth position meters must be an integer",
        },
        { status: 400 },
      );
    }

    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!vessel) {
      return NextResponse.json(
        { error: "Vessel not found" },
        { status: 404 },
      );
    }

    if (
      !vessel.isActive &&
      vessel.id !== existingSchedule.vesselId
    ) {
      return NextResponse.json(
        {
          error:
            "Only active vessels can be selected",
        },
        { status: 400 },
      );
    }

    const terminal = await prisma.terminal.findUnique({
      where: { id: terminalId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!terminal) {
      return NextResponse.json(
        { error: "Terminal not found" },
        { status: 404 },
      );
    }

    if (
      !terminal.isActive &&
      terminal.id !== existingSchedule.terminalId
    ) {
      return NextResponse.json(
        {
          error:
            "Only active terminals can be selected",
        },
        { status: 400 },
      );
    }

    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!service) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 },
        );
      }

      if (
        !service.isActive &&
        service.id !== existingSchedule.serviceId
      ) {
        return NextResponse.json(
          {
            error:
              "Only active services can be selected",
          },
          { status: 400 },
        );
      }
    }

    if (berthId) {
      const berth = await prisma.berth.findUnique({
        where: { id: berthId },
        select: {
          id: true,
          terminalId: true,
          isActive: true,
        },
      });

      if (!berth) {
        return NextResponse.json(
          { error: "Berth not found" },
          { status: 404 },
        );
      }

      if (berth.terminalId !== terminalId) {
        return NextResponse.json(
          {
            error:
              "The selected berth does not belong to the selected terminal",
          },
          { status: 400 },
        );
      }

      if (
        !berth.isActive &&
        berth.id !== existingSchedule.berthId
      ) {
        return NextResponse.json(
          {
            error:
              "Only active berths can be selected",
          },
          { status: 400 },
        );
      }

      const overlap = await hasBerthOverlap({
        berthId,
        eta,
        etb,
        etd,
        excludeScheduleId: id,
      });

      if (overlap) {
        return NextResponse.json(
          {
            error:
              "The selected berth already has an overlapping schedule",
          },
          { status: 409 },
        );
      }
    }

    const schedule = await prisma.vesselSchedule.update({
      where: { id },
      data: {
        vesselId,
        terminalId,
        berthId,
        serviceId,
        voyageNumber: trimOptionalString(
          body.voyageNumber,
        ),
        eta,
        etb,
        etd,
        ata,
        atb,
        atd,
        status: status as ScheduleStatus,
        remarks: trimOptionalString(body.remarks),
        berthPositionMeters,
        headingReverse,
      },
      include: {
        vessel: {
          select: {
            id: true,
            imo: true,
            name: true,
            callSign: true,
          },
        },
        terminal: {
          select: {
            id: true,
            code: true,
            name: true,
            port: {
              select: {
                id: true,
                code: true,
                name: true,
                timezone: true,
              },
            },
          },
        },
        berth: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
            zeroOriginSide: true,
          },
        },
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
            isActive: true,
            company: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      data: mapSchedule(schedule),
    });
  } catch (error) {
    console.error("Failed to update schedule:", error);

    return NextResponse.json(
      {
        error: "Failed to update schedule",
      },
      {
        status: 500,
      },
    );
  }
}
