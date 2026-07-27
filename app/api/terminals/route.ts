import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const terminals = await prisma.terminal.findMany({
      include: {
        port: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          port: {
            name: "asc",
          },
        },
        {
          code: "asc",
        },
      ],
    });

    return NextResponse.json({
      data: terminals,
    });
  } catch (error) {
    console.error("Failed to load terminals:", error);

    return NextResponse.json(
      {
        error: "Failed to load terminals",
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

    if (!body.portId || typeof body.portId !== "string") {
      return NextResponse.json(
        {
          error: "Port is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        {
          error: "Terminal code is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        {
          error: "Terminal name is required",
        },
        {
          status: 400,
        },
      );
    }

    const portId = body.portId.trim();
    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();

    if (!portId) {
      return NextResponse.json(
        {
          error: "Port is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          error: "Terminal code is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          error: "Terminal name is required",
        },
        {
          status: 400,
        },
      );
    }

    const port = await prisma.port.findUnique({
      where: {
        id: portId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!port) {
      return NextResponse.json(
        {
          error: "Port not found",
        },
        {
          status: 404,
        },
      );
    }

    const existingTerminal = await prisma.terminal.findFirst({
      where: {
        portId,
        code,
      },
      select: {
        id: true,
      },
    });

    if (existingTerminal) {
      return NextResponse.json(
        {
          error: "Terminal code already exists for this port",
        },
        {
          status: 409,
        },
      );
    }

    const terminal = await prisma.terminal.create({
      data: {
        organizationId: "00000000-0000-4000-8000-000000000001", // TODO Prompt 2: replace with authenticated org
        portId,
        code,
        name,
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : true,
      },
      include: {
        port: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: terminal,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Failed to create terminal:", error);

    return NextResponse.json(
      {
        error: "Failed to create terminal",
      },
      {
        status: 500,
      },
    );
  }
}