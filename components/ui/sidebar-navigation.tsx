"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav className={["flex h-full flex-col", className].filter(Boolean).join(" ")}>
      <div className="border-b border-slate-200 px-4 py-4">
        <p className="text-lg font-semibold text-slate-900">Vessel Schedule</p>
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
      </div>
    </nav>
  );
}
