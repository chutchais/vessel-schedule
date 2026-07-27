import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { AuthError } from "./auth-errors";

export type CurrentUserContext = {
  id: string;
  email: string;
  displayName: string;
  platformRole: "USER" | "SUPER_ADMIN";
  activeOrganization: { id: string; name: string; slug: string };
  membership: { role: "OWNER" | "ADMIN" | "PLANNER" | "VIEWER" };
  availableOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: "OWNER" | "ADMIN" | "PLANNER" | "VIEWER";
  }>;
};

const ROLE_PRIORITY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  PLANNER: 2,
  VIEWER: 1,
};

export async function requireCurrentUser(): Promise<CurrentUserContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError(401, "Authentication required");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      platformRole: true,
      isActive: true,
    },
  });

  if (!dbUser) {
    throw new AuthError(403, "User profile not found");
  }

  if (!dbUser.isActive) {
    throw new AuthError(403, "User account is inactive");
  }

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: dbUser.id,
      isActive: true,
      organization: { isActive: true },
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  if (memberships.length === 0) {
    throw new AuthError(403, "No active organization membership found");
  }

  const availableOrganizations = memberships.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    role: membership.role as "OWNER" | "ADMIN" | "PLANNER" | "VIEWER",
  }));

  const cookieStore = await cookies();
  const activeOrgCookie = cookieStore.get("active_organization_id")?.value;

  let activeMembership = activeOrgCookie
    ? memberships.find((membership) => membership.organization.id === activeOrgCookie) ?? null
    : null;

  if (!activeMembership) {
    activeMembership = [...memberships].sort(
      (a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0),
    )[0];
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.displayName,
    platformRole: dbUser.platformRole as "USER" | "SUPER_ADMIN",
    activeOrganization: {
      id: activeMembership.organization.id,
      name: activeMembership.organization.name,
      slug: activeMembership.organization.slug,
    },
    membership: {
      role: activeMembership.role as "OWNER" | "ADMIN" | "PLANNER" | "VIEWER",
    },
    availableOrganizations,
  };
}
