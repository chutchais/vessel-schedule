"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlowPortLogo } from "@/components/brand/flowport-logo";

export type NavigationItem = {
  label: string;
  href: string;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    title: "Master Data",
    items: [
      { label: "Companies", href: "/companies" },
      { label: "Ports", href: "/ports" },
      { label: "Terminals", href: "/terminals" },
      { label: "Berths", href: "/berths" },
      { label: "Vessels", href: "/vessels" },
      { label: "Services", href: "/services" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Vessel Schedules", href: "/schedules" },
      { label: "Berth Planner", href: "/berth-planner" },
    ],
  },
];

type UserContext = {
  id: string;
  displayName: string;
  email: string;
  platformRole: "USER" | "SUPER_ADMIN";
  activeOrganization: { id: string; name: string; slug: string };
  membership: { role: string };
  availableOrganizations: Array<{ id: string; name: string; slug: string; role: string }>;
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  PLANNER: "bg-green-100 text-green-700",
  VIEWER: "bg-slate-100 text-slate-600",
};

function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }

  return href !== "/" && pathname.startsWith(`${href}/`);
}

type SidebarNavigationProps = {
  className?: string;
  onNavigate?: () => void;
};

export function SidebarNavigation({ className = "", onNavigate }: SidebarNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.replace("/login");
          }
          return;
        }

        const payload = (await response.json()) as { data?: UserContext };
        if (active) {
          setUserContext(payload.data ?? null);
        }
      } catch {
        if (active) {
          setUserContext(null);
        }
      } finally {
        if (active) {
          setIsLoadingUser(false);
        }
      }
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleOrganizationChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const organizationId = event.target.value;
    if (!organizationId || organizationId === userContext?.activeOrganization.id) {
      return;
    }

    setIsSwitchingOrg(true);

    try {
      const response = await fetch("/api/auth/active-organization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        throw new Error("Failed to switch organization");
      }

      const nextOrganization = userContext?.availableOrganizations.find(
        (organization) => organization.id === organizationId,
      );

      setUserContext((current) =>
        current && nextOrganization
          ? {
              ...current,
              activeOrganization: {
                id: nextOrganization.id,
                name: nextOrganization.name,
                slug: nextOrganization.slug,
              },
              membership: { role: nextOrganization.role },
            }
          : current,
      );

      router.refresh();
    } catch {
      event.target.value = userContext?.activeOrganization.id ?? "";
    } finally {
      setIsSwitchingOrg(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
      onNavigate?.();
    }
  }

  return (
    <nav className={["flex h-full flex-col", className].filter(Boolean).join(" ")}>
      <div className="border-b border-slate-200 px-4 py-4">
        <Link href="/berth-planner" aria-label="FlowPort Berth Planner" onClick={onNavigate} className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><FlowPortLogo compact showDomain={false} /></Link>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAVIGATION_GROUPS.map((group) => (
          <section key={group.title}>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</p>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive = isActivePath(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={[
                        "block rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        isActive
                          ? "bg-blue-50 font-medium text-blue-700"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {userContext?.platformRole === "SUPER_ADMIN" && (
          <section>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Platform Administration</p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link
                  href="/admin/organization-requests"
                  onClick={onNavigate}
                  className={[
                    "block rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    isActivePath(pathname, "/admin/organization-requests")
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  Organization Requests
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/audit-logs"
                  onClick={onNavigate}
                  className={[
                    "block rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    isActivePath(pathname, "/admin/audit-logs")
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  Audit Logs
                </Link>
              </li>
            </ul>
          </section>
        )}

        {(userContext?.membership.role === "OWNER" || userContext?.membership.role === "ADMIN") && (
          <section>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Administration</p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link
                  href="/audit-logs"
                  onClick={onNavigate}
                  className={[
                    "block rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    isActivePath(pathname, "/audit-logs")
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  Audit Logs
                </Link>
              </li>
            </ul>
          </section>
        )}

        {(userContext?.membership.role === "OWNER" || userContext?.membership.role === "ADMIN") && (
          <section>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Settings</p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link
                  href="/settings/organization"
                  onClick={onNavigate}
                  className={[
                    "block rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    isActivePath(pathname, "/settings/organization")
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  Organization
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/members"
                  onClick={onNavigate}
                  className={[
                    "block rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    isActivePath(pathname, "/settings/members")
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  Members
                </Link>
              </li>
            </ul>
          </section>
        )}
      </div>

      <div className="border-t border-slate-200 p-4">
        {isLoadingUser ? (
          <p className="text-sm text-slate-500">Loading account...</p>
        ) : userContext ? (
          <div className="space-y-3">
            {userContext.availableOrganizations.length > 1 ? (
              <div>
                <label htmlFor="active-organization" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Organization
                </label>
                <select
                  id="active-organization"
                  value={userContext.activeOrganization.id}
                  onChange={handleOrganizationChange}
                  disabled={isSwitchingOrg}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {userContext.availableOrganizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Organization</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{userContext.activeOrganization.name}</p>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{userContext.displayName}</p>
                  <p className="truncate text-xs text-slate-500">{userContext.email}</p>
                </div>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    ROLE_COLORS[userContext.membership.role] ?? ROLE_COLORS.VIEWER,
                  ].join(" ")}
                >
                  {userContext.membership.role}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
