import type { Metadata } from "next";
import Link from "next/link";
import { getOptionalCurrentUser } from "@/lib/auth/optional-current-user";
import { LandingHeader } from "./_components/landing-header";

export const metadata: Metadata = {
  title: "Vessel Schedule | Berth Planning and Maritime Operations",
  description:
    "Manage vessel calls, services, terminals, berths, and schedules in an organization-based maritime operations workspace.",
  openGraph: {
    title: "Vessel Schedule | Berth Planning and Maritime Operations",
    description:
      "Manage vessel calls, services, terminals, berths, and schedules in an organization-based maritime operations workspace.",
    type: "website",
  },
};

const FEATURES = [
  {
    title: "Vessel Schedules",
    description:
      "Coordinate vessel calls, voyage numbers, services, terminals, berths, and planned or actual times.",
    icon: (
      <svg aria-hidden="true" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Berth Management",
    description:
      "Maintain berth length, display order, color, zero-origin direction, and vessel position.",
    icon: (
      <svg aria-hidden="true" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  {
    title: "Master Data",
    description:
      "Manage companies, ports, terminals, vessels, and shipping services in one consistent interface.",
    icon: (
      <svg aria-hidden="true" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    title: "Organization Workspaces",
    description:
      "Keep each organization's users and operational data separated.",
    icon: (
      <svg aria-hidden="true" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    title: "Roles & Permissions",
    description:
      "Control access for Owners, Admins, Planners, and Viewers.",
    icon: (
      <svg aria-hidden="true" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    title: "Audit History",
    description:
      "Review important changes with organization-scoped activity history.",
    icon: (
      <svg aria-hidden="true" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Request Access",
    description: "Submit your organization or business name and contact details.",
  },
  {
    step: "2",
    title: "Platform Review",
    description: "A platform administrator reviews and approves the organization request.",
  },
  {
    step: "3",
    title: "Invite Your Team",
    description: "The Organization Owner invites Admins, Planners, and Viewers.",
  },
  {
    step: "4",
    title: "Plan Operations",
    description: "Create master data and coordinate vessel schedules within your private workspace.",
  },
] as const;

const SECURITY_ITEMS = [
  "Organization-scoped data access on every server request",
  "Server-side authentication verified before database operations",
  "Role-based permissions: Owner, Admin, Planner, and Viewer",
  "Verified invitation email matching for new team members",
  "Protected platform administration with super-admin checks",
  "Supabase Admin operations confined to server-only code paths",
] as const;

/** Static berth timeline demonstration — no real data is fetched */
function BerthPreview() {
  return (
    <div
      aria-label="Example berth schedule preview"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md"
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden="true" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" aria-hidden="true" />
        <span className="ml-2 text-xs font-medium text-slate-500">Berth Schedule — Demo</span>
      </div>

      {/* Timeline content */}
      <div className="p-4">
        {/* Time axis */}
        <div className="mb-2 flex items-center">
          <div className="w-20 shrink-0" />
          <div className="flex flex-1 text-xs text-slate-400">
            {["08:00", "10:00", "12:00", "14:00", "16:00"].map((t) => (
              <span key={t} className="flex-1 text-center first:text-left last:text-right">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Berth rows */}
        <div className="space-y-2">
          {/* Berth A */}
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-medium text-slate-600">Berth A</span>
            <div className="relative flex-1 h-8 rounded bg-slate-50 border border-slate-200">
              {/* Vessel 101 — 08:00 to 12:00 (50%) */}
              <div
                aria-label="Vessel 101, Service A1, 08:00–12:00"
                className="absolute inset-y-1 left-0 right-[50%] rounded bg-blue-500 flex items-center px-2 overflow-hidden"
                style={{ marginLeft: "1px" }}
              >
                <span className="truncate text-xs font-medium text-white">Vessel 101 · A1</span>
              </div>
              {/* Vessel 204 — 13:00 to 15:30 */}
              <div
                aria-label="Vessel 204, Service B2, 13:00–15:30"
                className="absolute inset-y-1 rounded bg-cyan-500 flex items-center px-2 overflow-hidden"
                style={{ left: "62.5%", right: "12.5%" }}
              >
                <span className="truncate text-xs font-medium text-white">V 204</span>
              </div>
            </div>
          </div>

          {/* Berth B */}
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-medium text-slate-600">Berth B</span>
            <div className="relative flex-1 h-8 rounded bg-slate-50 border border-slate-200">
              {/* Vessel 055 — 09:00 to 14:00 */}
              <div
                aria-label="Vessel 055, Service C3, 09:00–14:00"
                className="absolute inset-y-1 rounded bg-violet-500 flex items-center px-2 overflow-hidden"
                style={{ left: "12.5%", right: "25%" }}
              >
                <span className="truncate text-xs font-medium text-white">Vessel 055 · C3</span>
              </div>
            </div>
          </div>

          {/* Berth C */}
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-medium text-slate-600">Berth C</span>
            <div className="relative flex-1 h-8 rounded bg-slate-50 border border-slate-200">
              {/* Vessel 312 — 11:00 to 13:00 */}
              <div
                aria-label="Vessel 312, 11:00–13:00"
                className="absolute inset-y-1 rounded bg-emerald-500 flex items-center px-2 overflow-hidden"
                style={{ left: "37.5%", right: "37.5%" }}
              >
                <span className="truncate text-xs font-medium text-white">V 312</span>
              </div>
              {/* Vessel 089 — 14:30 to 16:00 */}
              <div
                aria-label="Vessel 089, 14:30–16:00"
                className="absolute inset-y-1 rounded bg-amber-500 flex items-center px-2 overflow-hidden"
                style={{ left: "81.25%", right: "0%" }}
              >
                <span className="truncate text-xs font-medium text-white">V 089</span>
              </div>
            </div>
          </div>
        </div>

        {/* ETA/ETD labels */}
        <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" aria-hidden="true" />
            <span className="text-xs text-slate-500">ETA 08:00 · ETD 12:00</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" aria-hidden="true" />
            <span className="text-xs text-slate-500">ETA 09:00 · ETD 14:00</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-cyan-500" aria-hidden="true" />
            <span className="text-xs text-slate-500">ETA 13:00 · ETD 15:30</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const user = await getOptionalCurrentUser();

  const showDashboard = user !== null && user.hasMembership;
  const showInvitations = user !== null && !user.hasMembership;
  const showAdmin = user !== null && user.platformRole === "SUPER_ADMIN";

  return (
    <>
      {/* ── Announcement bar ── */}
      {!showDashboard && !showInvitations && (
        <div className="bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white">
          Ready to get started?{" "}
          <Link
            href="/request-access"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-blue-600 rounded-sm"
          >
            Request Access
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>
      )}

      <LandingHeader
        showDashboard={showDashboard}
        showInvitations={showInvitations}
        showAdmin={showAdmin}
      />

      <main>
        {/* ── Hero ── */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                  Plan vessel calls{" "}
                  <span className="text-blue-600">with clarity</span>
                </h1>
                <p className="mt-5 text-lg leading-relaxed text-slate-600">
                  Manage vessels, services, terminals, berths, and port-call schedules in one organized workspace.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  {showDashboard ? (
                    <>
                      <Link
                        href="/schedules"
                        className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-6 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                      >
                        Open Dashboard
                      </Link>
                      {showAdmin && (
                        <Link
                          href="/admin/organization-requests"
                          className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                        >
                          Platform Administration
                        </Link>
                      )}
                    </>
                  ) : showInvitations ? (
                    <Link
                      href="/invitations"
                      className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-6 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                    >
                      View Invitations
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/request-access"
                        className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-6 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                      >
                        Request Access
                      </Link>
                      <Link
                        href="/login"
                        className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                      >
                        Sign In
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div>
                <BerthPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="bg-slate-50 border-t border-slate-200">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Everything needed for vessel scheduling
              </h2>
              <p className="mt-3 text-base text-slate-600">
                Purpose-built tools for maritime operations teams.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="bg-white border-t border-slate-200">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Start with a controlled organization workspace
              </h2>
              <p className="mt-3 text-base text-slate-600">
                Access is granted by invitation through an approved organization.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item, index) => (
                <div key={item.step} className="relative">
                  {/* Connector line (hidden on last item) */}
                  {index < STEPS.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="absolute top-5 left-10 hidden h-px w-[calc(100%+2rem)] border-t border-dashed border-slate-300 lg:block"
                    />
                  )}
                  <div className="flex flex-col items-start">
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-sm font-bold text-blue-600">
                      {item.step}
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security ── */}
        <section id="security" className="bg-slate-50 border-t border-slate-200">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Designed around organization boundaries
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Each request is evaluated using the authenticated user, active organization
                  membership, and assigned role. Organization data is scoped on the server before
                  database operations are performed.
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  Authentication is powered by Supabase. Platform administration
                  uses server-only Admin API calls that are never exposed to the browser.
                </p>
              </div>
              <ul className="space-y-4" aria-label="Security controls">
                {SECURITY_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100"
                    >
                      <svg className="h-3 w-3 text-blue-600" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M3.5 6.5L5 8l3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </span>
                    <span className="text-sm leading-relaxed text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="bg-white border-t border-slate-200">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Ready to organize your vessel schedules?
            </h2>
            <p className="mt-4 text-base text-slate-600">
              Request access to get started, or sign in if you already have an account.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {showDashboard ? (
                <Link
                  href="/schedules"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-8 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                >
                  Open Dashboard
                </Link>
              ) : showInvitations ? (
                <Link
                  href="/invitations"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-8 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                >
                  View Invitations
                </Link>
              ) : (
                <>
                  <Link
                    href="/request-access"
                    className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-8 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                  >
                    Request Access
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-8 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-900">Vessel Schedule</p>
              <p className="mt-1 text-xs text-slate-500 max-w-xs">
                Berth planning and maritime operations workspace for shipping teams.
              </p>
            </div>
            <nav aria-label="Footer links" className="flex flex-wrap items-center gap-5">
              <Link
                href="/login"
                className="text-sm text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/request-access"
                className="text-sm text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm transition-colors"
              >
                Request Access
              </Link>
            </nav>
          </div>
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Vessel Schedule. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
