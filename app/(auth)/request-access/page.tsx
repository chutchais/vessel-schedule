import Link from "next/link";

export default function RequestAccessPage() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Request access</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Access is managed by your organization administrator. If you need an account, contact your
          operations lead or system administrator and provide the email address you want linked to
          Supabase authentication.
        </p>
        <Link href="/login" className="mt-6 inline-flex text-sm font-medium text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
