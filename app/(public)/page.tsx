import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getLandingActions } from "@/lib/landing/actions";
import { LandingHeader } from "./_components/landing-header";
import { FlowPortLogo } from "@/components/brand/flowport-logo";

export const metadata: Metadata = {
  title: "FlowPort | Berth Planning",
  description: "Visual berth planning for modern terminal operations.",
  alternates: { canonical: "https://getflowport.com" },
  openGraph: { title: "FlowPort | Berth Planning", description: "Visual berth planning for modern terminal operations.", url: "https://getflowport.com", type: "website" },
};

const CAPABILITIES = [
  ["Visual weekly Berth Planner", "Review terminal calls across a clear, timezone-aware weekly planning surface."],
  ["Position and datetime views", "Switch between berth-position geometry and datetime lanes without losing planning context."],
  ["Direct schedule adjustments", "Move vessel calls with drag-and-drop and resize their planned duration on the canvas."],
  ["Overlap detection", "Identify berth and vessel occupancy conflicts across time and position."],
  ["Operational filters and search", "Focus the plan by vessel, voyage, service, status, berth, conflicts, or incomplete placement."],
  ["Recent changes and undo", "Highlight recent planner activity and safely undo eligible planning changes."],
  ["Configurable vessel labels", "Choose structured, safe label content and personal on-screen label sizing."],
  ["Print, PDF and schedule export", "Prepare weekly print/PDF output or export filtered schedule data as CSV."],
  ["Users, roles and invitations", "Organize Owners, Admins, Planners, and Viewers through controlled invitations."],
  ["Object-level audit history", "Open the recorded history for supported operational objects and review important changes."],
  ["Secure read-only planner sharing", "Create expiring, revocable links to a fixed planner scope without exposing editing controls."],
] as const;

const WORKFLOW = [
  "Set up organization",
  "Add terminal, berth, vessel and service",
  "Create schedules",
  "Operate from the Berth Planner",
  "Share or export the plan",
] as const;

const SECURITY = [
  ["Organization data isolation", "Operational reads and writes are scoped to the active organization on the server."],
  ["Role-based permissions", "Owner, Admin, Planner, and Viewer roles separate administrative, planning, and viewing actions."],
  ["Audit logs", "Organization and object-level histories record important changes without exposing secrets."],
  ["Controlled public sharing", "Read-only planner links expire, can be revoked, and use hashed secrets with short-lived viewer sessions."],
] as const;

async function platformAdminExists() {
  await connection();
  try {
    return await prisma.user.count({ where: { platformRole: "SUPER_ADMIN", isActive: true } }) > 0;
  } catch {
    // Never expose setup based on an uncertain database state.
    return true;
  }
}

function PlannerPreview() {
  const calls = [
    { berth: "Berth 1", vessel: "MV Horizon", detail: "SEA-12 · 08:00–18:00", position: "left-[8%] right-[42%] bg-blue-500" },
    { berth: "Berth 2", vessel: "Ocean Cedar", detail: "NORTH · 11:30–22:00", position: "left-[28%] right-[18%] bg-cyan-600" },
    { berth: "Berth 3", vessel: "Pacific Dawn", detail: "Voyage 204", position: "left-[55%] right-[4%] bg-violet-500" },
  ];
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" aria-label="Illustrative weekly berth planner">
    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><span className="text-xs font-semibold text-slate-700">Weekly Berth Planner</span><span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">Position view</span></div>
    <div className="p-4 sm:p-5"><div className="mb-3 ml-24 grid grid-cols-4 text-center text-[10px] font-medium text-slate-400"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span></div><div className="space-y-3">{calls.map((call) => <div key={call.berth} className="flex items-center gap-3"><span className="w-20 shrink-0 text-xs font-medium text-slate-600">{call.berth}</span><div className="relative h-14 flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-50"><div className="absolute inset-y-1/2 border-t border-dashed border-slate-200 left-0 right-0"/><div className={`absolute inset-y-2 flex min-w-24 flex-col justify-center rounded-md px-2 text-white shadow-sm ${call.position}`}><span className="truncate text-xs font-semibold">{call.vessel}</span><span className="truncate text-[10px] text-white/85">{call.detail}</span></div></div></div>)}</div><div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><span>Port timezone</span><span>•</span><span>Live schedule scope</span><span>•</span><span>Conflict aware</span></div></div>
  </div>;
}

export default async function LandingPage() {
  const hasPlatformAdmin = await platformAdminExists();
  const actions = getLandingActions(hasPlatformAdmin);
  const primaryClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
  const secondaryClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
  return <>
    <LandingHeader showPlatformSetup={!hasPlatformAdmin}/>
    <main>
      <section className="bg-white"><div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-24"><div><p className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Invite-only pilot for terminal operations teams</p><h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Plan Berth Operations with Confidence</h1><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">FlowPort gives terminals a visual weekly berth plan for coordinating vessel calls, berth position, timing, conflicts, and operational handoffs in one controlled workspace.</p><div className="mt-8 flex flex-wrap gap-3"><Link href={actions.primary.href} className={primaryClass}>{actions.primary.label}</Link><Link href={actions.secondary.href} className={secondaryClass}>{actions.secondary.label}</Link>{actions.setup ? <Link href={actions.setup.href} className={secondaryClass}>{actions.setup.label}</Link> : null}</div></div><PlannerPreview/></div></section>

      <section id="capabilities" className="border-t border-slate-200 bg-slate-50"><div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Current MVP</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Tools for the weekly operating plan</h2><p className="mt-3 text-slate-600">Plan, review, communicate, and trace berth activity without turning the pilot into a broader terminal operating system.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{CAPABILITIES.map(([title, description]) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div aria-hidden="true" className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-lg font-bold text-blue-600">✓</div><h3 className="font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div></div></section>

      <section id="workflow" className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Workflow</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">From setup to an operational plan</h2></div><ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{WORKFLOW.map((step, index) => <li key={step} className="relative rounded-xl border border-slate-200 bg-slate-50 p-5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{index + 1}</span><p className="mt-4 text-sm font-semibold leading-6 text-slate-900">{step}</p>{index < WORKFLOW.length - 1 ? <span aria-hidden="true" className="absolute -right-3 top-7 z-10 hidden text-slate-300 lg:block">→</span> : null}</li>)}</ol></div></section>

      <section id="security" className="border-t border-slate-200 bg-slate-950 text-white"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[0.75fr_1.25fr] lg:px-8"><div><p className="text-sm font-semibold uppercase tracking-wider text-blue-300">Access and accountability</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Security controls in the MVP</h2><p className="mt-4 leading-7 text-slate-300">The pilot applies server-side organization boundaries and permission checks to operational workflows and controlled external sharing.</p></div><div className="grid gap-4 sm:grid-cols-2">{SECURITY.map(([title, description]) => <article key={title} className="rounded-xl border border-slate-700 bg-slate-900 p-5"><h3 className="font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{description}</p></article>)}</div></div></section>

      <section id="pilot" className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-18"><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Pilot status</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Built for focused evaluation with invited teams</h2><p className="mt-4 leading-7 text-slate-600">FlowPort is an invite-only MVP pilot. It is intended for evaluating berth-planning workflows with selected port and terminal operators; it does not claim enterprise readiness, guaranteed uptime, or completed compliance certification.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/request-access" className={primaryClass}>Request Access</Link><Link href="/login" className={secondaryClass}>Sign In</Link></div></div></section>
      <section id="contact" className="border-t border-slate-200 bg-slate-50"><div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-14 sm:px-6 sm:py-18 md:grid-cols-[1fr_auto]"><div><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Contact Us</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Talk with the FlowPort team</h2><p className="mt-4 max-w-2xl leading-7 text-slate-600">Contact us about pilot access, product support, or questions about using FlowPort for terminal berth planning.</p><p className="mt-3 select-text text-base font-semibold text-[#0b3b5c]">support@getflowport.com</p></div><a href="mailto:support@getflowport.com" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#0b3b5c] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#082f4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7a9b] focus-visible:ring-offset-2">Email Us</a></div></section>
    </main>
    <footer className="border-t border-slate-200 bg-slate-50"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div><FlowPortLogo compact/><p className="mt-1 text-xs text-slate-500">Visual berth planning for modern terminal operations.</p></div><nav aria-label="Footer links" className="flex flex-wrap gap-5"><a href="https://getflowport.com" className="rounded-sm text-sm text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">getflowport.com</a><a href="mailto:support@getflowport.com" className="rounded-sm text-sm text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Contact Us</a><Link href="/privacy" className="rounded-sm text-sm text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Privacy</Link><Link href="/request-access" className="rounded-sm text-sm text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Request Access</Link><Link href="/login" className="rounded-sm text-sm text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Sign In</Link></nav></div></footer>
  </>;
}
