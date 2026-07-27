import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export type OptionalUserContext = {
  id: string;
  platformRole: "USER" | "SUPER_ADMIN";
  hasMembership: boolean;
} | null;

/**
 * Returns basic user context for the current session, or null for guests.
 * Never throws — safe to call from public pages.
 */
export async function getOptionalCurrentUser(): Promise<OptionalUserContext> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, platformRole: true, isActive: true },
    });

    if (!dbUser || !dbUser.isActive) return null;

    const membershipCount = await prisma.organizationMember.count({
      where: {
        userId: dbUser.id,
        isActive: true,
        organization: { isActive: true },
      },
    });

    return {
      id: dbUser.id,
      platformRole: dbUser.platformRole as "USER" | "SUPER_ADMIN",
      hasMembership: membershipCount > 0,
    };
  } catch {
    return null;
  }
}
