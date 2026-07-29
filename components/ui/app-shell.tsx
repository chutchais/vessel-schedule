"use client";

import { ReactNode, useEffect, useState } from "react";
import { MobileNavigation } from "@/components/ui/mobile-navigation";
import { SidebarNavigation } from "@/components/ui/sidebar-navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [plannerFocus, setPlannerFocus] = useState(false);
  useEffect(() => {
    const update = (event: Event) => setPlannerFocus((event as CustomEvent<boolean>).detail === true);
    window.addEventListener("planner-focus-mode", update);
    return () => window.removeEventListener("planner-focus-mode", update);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className={`hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block [@media(max-height:850px)]:hidden ${plannerFocus ? "!hidden" : ""}`}>
          <SidebarNavigation />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <MobileNavigation className={`lg:hidden [@media(max-height:850px)]:block ${plannerFocus ? "!hidden" : ""}`} />
          <main className={`min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 ${plannerFocus ? "p-0" : ""}`}>{children}</main>
        </div>
      </div>
    </div>
  );
}
