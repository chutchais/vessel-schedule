import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { assertDatabaseTarget, formatDatabaseTarget } from "../lib/db/target-guard";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const target = assertDatabaseTarget({ purpose: "bootstrap" });
  console.log(formatDatabaseTarget(target));
  const authUserId = process.env.BOOTSTRAP_AUTH_USER_ID;
  const email = process.env.BOOTSTRAP_USER_EMAIL?.toLowerCase().trim();
  const displayName = process.env.BOOTSTRAP_USER_DISPLAY_NAME?.trim();
  const orgSlug = process.env.BOOTSTRAP_ORGANIZATION_SLUG?.trim();

  if (!authUserId || !UUID_REGEX.test(authUserId)) {
    throw new Error("BOOTSTRAP_AUTH_USER_ID must be a valid UUID");
  }
  if (!email) throw new Error("BOOTSTRAP_USER_EMAIL is required");
  if (!displayName) throw new Error("BOOTSTRAP_USER_DISPLAY_NAME is required");
  if (!orgSlug) throw new Error("BOOTSTRAP_ORGANIZATION_SLUG is required");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (!org) throw new Error(`Organization with slug '${orgSlug}' not found`);
    if (!org.isActive) throw new Error(`Organization '${orgSlug}' is inactive`);

    const user = await prisma.user.upsert({
      where: { id: authUserId },
      create: {
        id: authUserId,
        email,
        displayName,
        platformRole: "SUPER_ADMIN",
        isActive: true,
      },
      update: {
        email,
        displayName,
        platformRole: "SUPER_ADMIN",
        isActive: true,
      },
    });

    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        role: "OWNER",
        isActive: true,
      },
      update: {
        role: "OWNER",
        isActive: true,
      },
    });

    console.log(`✓ User '${displayName}' (${email}) set as SUPER_ADMIN`);
    console.log(`✓ OWNER membership in org '${org.name}' (${orgSlug})`);
    console.log("Bootstrap complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: Error) => {
  console.error("Bootstrap failed:", err.message);
  process.exit(1);
});
