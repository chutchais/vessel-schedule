import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail, isValidEmail } from "@/lib/auth/email";

interface RequestBody {
  organizationName?: string;
  requesterName?: string;
  requesterEmail?: string;
  phone?: string;
  message?: string;
  website?: string;
}

function validateInput(body: RequestBody): {
  valid: boolean;
  error?: string;
  normalized?: {
    organizationName: string;
    requesterName: string;
    requesterEmail: string;
    phone: string | null;
    message: string | null;
  };
} {
  const { organizationName, requesterName, requesterEmail, phone, message, website } = body;

  if (!organizationName || typeof organizationName !== "string") {
    return { valid: false, error: "organizationName is required" };
  }

  if (organizationName.trim().length === 0 || organizationName.trim().length > 200) {
    return { valid: false, error: "organizationName must be 1-200 characters" };
  }

  if (!requesterName || typeof requesterName !== "string") {
    return { valid: false, error: "requesterName is required" };
  }

  if (requesterName.trim().length === 0 || requesterName.trim().length > 200) {
    return { valid: false, error: "requesterName must be 1-200 characters" };
  }

  if (!requesterEmail || typeof requesterEmail !== "string") {
    return { valid: false, error: "requesterEmail is required" };
  }

  const normalizedEmail = normalizeEmail(requesterEmail);

  if (!isValidEmail(normalizedEmail)) {
    return { valid: false, error: "requesterEmail must be a valid email address" };
  }

  if (phone && (typeof phone !== "string" || phone.length > 50)) {
    return { valid: false, error: "phone must be 0-50 characters" };
  }

  if (message && (typeof message !== "string" || message.length > 2000)) {
    return { valid: false, error: "message must be 0-2000 characters" };
  }

  if (website && website !== "") {
    return { valid: false, error: "honeypot check failed" };
  }

  return {
    valid: true,
    normalized: {
      organizationName: organizationName.trim(),
      requesterName: requesterName.trim(),
      requesterEmail: normalizedEmail,
      phone: phone?.trim() ?? null,
      message: message?.trim() ?? null,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const validation = validateInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const normalized = validation.normalized!;

    const existingRequest = await prisma.organizationRequest.findFirst({
      where: {
        requesterEmail: normalized.requesterEmail,
        status: {
          in: ["PENDING", "APPROVING", "APPROVAL_FAILED"],
        },
      },
      select: { id: true },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          message: "Your request has been received and will be reviewed.",
        },
        { status: 200 }
      );
    }

    await prisma.organizationRequest.create({
      data: {
        organizationName: normalized.organizationName,
        requesterName: normalized.requesterName,
        requesterEmail: normalized.requesterEmail,
        phone: normalized.phone,
        message: normalized.message,
      },
    });

    return NextResponse.json(
      {
        message: "Your request has been received and will be reviewed.",
      },
      { status: 201 }
    );
  } catch {
    console.error("Failed to create organization request:");
    return NextResponse.json(
      { error: "Failed to process your request" },
      { status: 500 }
    );
  }
}
