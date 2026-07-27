import Link from "next/link";
import { RequestAccessForm } from "@/components/auth/request-access-form";

export default function RequestAccessPage() {
  return (
    <div className="w-full max-w-md">
      {/* Top brand link */}
      <div className="mb-6 text-center">
        <Link href="/" className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm">
          <span className="text-lg font-bold text-slate-900">Vessel Schedule</span>
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">Berth Planning &amp; Operations</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Request Access</h1>
        <p className="mt-1 text-base font-medium text-slate-700">
          Start with a controlled organization workspace
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Tell us about your organization and we&apos;ll get you set up.
        </p>
        <div className="mt-6">
          <RequestAccessForm />
        </div>
      </div>
    </div>
  );
}
