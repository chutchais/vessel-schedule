import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const COLOR_HEX_PATTERN = /^#[0-9A-F]{6}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function serializeBerth<
  T extends {
    berthLength: { toNumber(): number };
  },
>(berth: T) {
  return {
    ...berth,
    berthLength: berth.berthLength.toNumber(),
  };
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingBerth = await prisma.berth.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!existingBerth) {
      return NextResponse.json(
        { error: "Berth not found" },
        { status: 404 },
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

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { error: "Berth code is required" },
        { status: 400 },
      );
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Berth name is required" },
        { status: 400 },
      );
    }

    const terminalId = body.terminalId.trim();
    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    const color =
      typeof body.color === "string"
        ? body.color.trim().toUpperCase()
        : "#3B82F6";
    const zeroOriginSideRaw =
      typeof body.zeroOriginSide === "string"
        ? body.zeroOriginSide.trim().toLowerCase()
        : "left";
    const berthLength = Number(body.berthLength);
    const sortOrder = Number(body.sortOrder);

    if (!terminalId) {
      return NextResponse.json(
        { error: "Terminal is required" },
        { status: 400 },
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Berth code is required" },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Berth name is required" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(berthLength) || berthLength <= 0) {
      return NextResponse.json(
        { error: "Berth length must be greater than zero" },
        { status: 400 },
      );
    }

    if (!COLOR_HEX_PATTERN.test(color)) {
      return NextResponse.json(
        { error: "Color must match #RRGGBB" },
        { status: 400 },
      );
    }

    if (
      zeroOriginSideRaw !== "left" &&
      zeroOriginSideRaw !== "right"
    ) {
      return NextResponse.json(
        {
          error:
            "Zero origin side must be left or right",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return NextResponse.json(
        {
          error: "Sort order must be a non-negative integer",
        },
        { status: 400 },
      );
    }

    const terminal = await prisma.terminal.findUnique({
      where: {
        id: terminalId,
      },
      select: {
        id: true,
      },
    });

    if (!terminal) {
      return NextResponse.json(
        { error: "Terminal not found" },
        { status: 404 },
      );
    }

    const duplicateBerth = await prisma.berth.findFirst({
      where: {
        id: {
          not: id,
        },
        terminalId,
        code,
      },
      select: {
        id: true,
      },
    });

    if (duplicateBerth) {
      return NextResponse.json(
        {
          error:
            "Berth code already exists for this terminal",
        },
        { status: 409 },
      );
    }

    const berth = await prisma.berth.update({
      where: { id },
      data: {
        terminalId,
        code,
        name,
        berthLength,
        color,
        zeroOriginSide:
          zeroOriginSideRaw === "right"
            ? "RIGHT"
            : "LEFT",
        sortOrder,
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : existingBerth.isActive,
      },
      include: {
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
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      data: serializeBerth(berth),
    });
  } catch (error) {
    console.error("Failed to update berth:", error);

    return NextResponse.json(
      { error: "Failed to update berth" },
      { status: 500 },
    );
  }
}
