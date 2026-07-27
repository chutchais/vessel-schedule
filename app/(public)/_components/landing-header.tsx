"use client";

import Link from "next/link";
import { useState } from "react";

type LandingHeaderProps = {
  showDashboard?: boolean;
  showInvitations?: boolean;
  showAdmin?: boolean;
};

export function LandingHeader({ showDashboard, showInvitations, showAdmin }: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-sm">
              <span className="text-lg font-bold text-slate-900 leading-tight">Vessel Schedule</span>
              <span className="text-xs text-slate-500 leading-tight">Berth Planning &amp; Operations</span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Page sections">
            <a
              href="#features"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-sm transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-sm transition-colors"
            >
              How It Works
            </a>
            <a
              href="#security"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-sm transition-colors"
            >
              Security
            </a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {showDashboard ? (
              <>
                <Link
                  href="/schedules"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                >
                  Open Dashboard
                </Link>
                {showAdmin && (
                  <Link
                    href="/admin/organization-requests"
                    className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                  >
                    Platform Admin
                  </Link>
                )}
              </>
            ) : showInvitations ? (
              <Link
                href="/invitations"
                className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
              >
                View Invitations
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/request-access"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                >
                  Request Access
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
          >
            {menuOpen ? (
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M14 6l-8 8" />
              </svg>
            ) : (
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h12M4 10h12M4 14h12" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="mobile-menu" className="border-t border-slate-200 bg-white md:hidden">
          <nav className="px-4 pt-3 pb-3 space-y-1" aria-label="Mobile page sections">
            <a
              href="#features"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            >
              How It Works
            </a>
            <a
              href="#security"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            >
              Security
            </a>
          </nav>
          <div className="border-t border-slate-100 px-4 py-3 space-y-2">
            {showDashboard ? (
              <>
                <Link
                  href="/schedules"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                >
                  Open Dashboard
                </Link>
                {showAdmin && (
                  <Link
                    href="/admin/organization-requests"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                  >
                    Platform Admin
                  </Link>
                )}
              </>
            ) : showInvitations ? (
              <Link
                href="/invitations"
                onClick={() => setMenuOpen(false)}
                className="block w-full text-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
              >
                View Invitations
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/request-access"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                >
                  Request Access
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
