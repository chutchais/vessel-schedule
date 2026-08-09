import type { Metadata } from "next";
import Link from "next/link";
import { FlowPortLogo } from "@/components/brand/flowport-logo";

// Pilot notice only: obtain professional legal review before a broad public launch.
export const metadata: Metadata = {
  title: "Privacy Notice | FlowPort",
  description: "Privacy notice for the FlowPort invite-only pilot.",
  alternates: { canonical: "https://getflowport.com/privacy" },
};

const SECTIONS = [
  {
    title: "Information we collect",
    content: "We may collect your name, email address, organization details, access requests, invitations, account activity, audit logs, and operational data that users enter into FlowPort, such as terminal, berth, vessel, service, and schedule information.",
  },
  {
    title: "Why we collect it",
    content: "We use this information to authenticate users, manage organizations and access, provide berth-planning features, protect the service, respond to support requests, operate the pilot, and improve the service.",
  },
  {
    title: "Organization access and roles",
    content: "FlowPort separates organization workspaces. Users access information according to their organization membership and assigned role. Organization administrators are responsible for managing their users and deciding what operational data is entered.",
  },
  {
    title: "Service providers",
    content: "Providers that support hosting, databases, authentication, and email delivery may process information on our behalf as needed to operate FlowPort.",
  },
  {
    title: "Retention",
    content: "We retain information while it is needed to operate and evaluate the pilot, support users, maintain security and audit records, meet operational needs, or satisfy applicable legal obligations. Retention periods may vary by type of information and context.",
  },
  {
    title: "Security",
    content: "We use reasonable technical and organizational safeguards intended to protect information, including access controls and organization-scoped permissions. No system can guarantee absolute security.",
  },
  {
    title: "Your choices",
    content: "You may contact us to request access to, correction of, or deletion of your personal information where applicable. Some information may need to be retained for security, operational, or legal reasons.",
  },
  {
    title: "Public planner links",
    content: "Authorized organization users may create expiring, revocable, read-only links to a limited planner view. Anyone who receives a valid link may be able to view that shared scope until it expires or is revoked. Recipients should protect these links and should not redistribute them.",
  },
  {
    title: "Cookies and session storage",
    content: "FlowPort uses cookies and browser session or local storage where needed for authentication, security, user preferences, and essential application operation. We do not present a cookie-consent banner because the current pilot does not use non-essential tracking cookies.",
  },
] as const;

export default function PrivacyPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
    <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-6 sm:px-8 sm:py-8">
        <Link href="/" aria-label="FlowPort home" className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><FlowPortLogo compact /></Link>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-blue-700">Invite-only pilot</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Privacy Notice</h1>
        <p className="mt-4 leading-7 text-slate-600">This notice explains how FlowPort handles information during its invite-only pilot at <a href="https://getflowport.com" className="font-medium text-blue-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">getflowport.com</a>.</p>
        <dl className="mt-5 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><div><dt className="font-semibold text-slate-900">Effective date</dt><dd>August 9, 2026</dd></div><div><dt className="font-semibold text-slate-900">Last updated</dt><dd>August 9, 2026</dd></div></dl>
      </header>
      <div className="space-y-8 px-5 py-7 sm:px-8 sm:py-9">
        {SECTIONS.map((section) => <section key={section.title} aria-labelledby={`privacy-${section.title.toLowerCase().replaceAll(" ", "-")}`}><h2 id={`privacy-${section.title.toLowerCase().replaceAll(" ", "-")}`} className="text-xl font-semibold text-slate-950">{section.title}</h2><p className="mt-2 leading-7 text-slate-600">{section.content}</p></section>)}
        <section aria-labelledby="privacy-contact" className="rounded-xl bg-slate-50 p-5"><h2 id="privacy-contact" className="text-xl font-semibold text-slate-950">Contact</h2><p className="mt-2 leading-7 text-slate-600">For privacy questions or requests, email <a href="mailto:support@getflowport.com" className="font-semibold text-blue-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">support@getflowport.com</a>.</p></section>
      </div>
    </article>
  </main>;
}
