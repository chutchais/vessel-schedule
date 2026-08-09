"use client";

import { useEffect, useState } from "react";
import { SidebarNavigation } from "@/components/ui/sidebar-navigation";
import { FlowPortLogo } from "@/components/brand/flowport-logo";

type MobileNavigationProps = {
  className?: string;
};

export function MobileNavigation({ className = "" }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className={["border-b border-slate-200 bg-white", className].filter(Boolean).join(" ")}>
      <div className="flex h-14 items-center justify-between px-4">
        <FlowPortLogo compact showDomain={false} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-expanded={open}
          aria-controls="mobile-navigation-panel"
        >
          Menu
        </button>
      </div>

      {open ? (
        <div id="mobile-navigation-panel" className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />

          <aside className="relative h-full w-full max-w-xs border-r border-slate-200 bg-white shadow-xl">
            <SidebarNavigation onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
    </header>
  );
}
