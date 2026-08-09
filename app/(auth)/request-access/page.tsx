import Link from "next/link";
import { RequestAccessForm } from "@/components/auth/request-access-form";
import { FlowPortLogo } from "@/components/brand/flowport-logo";
import { emailDeliveryEnabled } from "@/lib/email/delivery-mode";

export default function RequestAccessPage() {
  const emailAvailable = emailDeliveryEnabled();
  return (
    <div className="w-full max-w-md">
      {/* Top brand link */}
      <div className="mb-6 text-center">
        <Link href="/" className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm">
          <FlowPortLogo compact />
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">Visual berth planning for modern terminal operations.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Request Access</h1>
        <p className="mt-1 text-base font-medium text-slate-700">
          Start with a controlled organization workspace
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Tell us about your organization and we&apos;ll get you set up.
        </p>
        {!emailAvailable && <p role="status" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Automated email delivery is currently unavailable. Your access request can still be recorded, but no confirmation email will be sent. Contact <a className="font-medium underline" href="mailto:support@getflowport.com">support@getflowport.com</a> for follow-up.</p>}
        <div className="mt-6">
          <RequestAccessForm emailAvailable={emailAvailable} />
        </div>
      </div>
      <p className="mt-5 text-center text-sm text-slate-500">By requesting access, you acknowledge the FlowPort <Link href="/privacy" className="font-medium text-blue-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Privacy Notice</Link>.</p>
    </div>
  );
}
