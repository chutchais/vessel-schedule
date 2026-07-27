import { RequestAccessForm } from "@/components/auth/request-access-form";

export default function RequestAccessPage() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Request access</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Tell us about your organization and we&apos;ll get you set up.
        </p>
        <div className="mt-6">
          <RequestAccessForm />
        </div>
      </div>
    </div>
  );
}
