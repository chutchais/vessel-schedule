import { ReactNode } from "react";
import { MobileNavigation } from "@/components/ui/mobile-navigation";
import { SidebarNavigation } from "@/components/ui/sidebar-navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
          <SidebarNavigation />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <MobileNavigation className="lg:hidden" />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
