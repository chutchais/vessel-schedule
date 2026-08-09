"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildAppUrl } from "@/lib/config/app-url";
import { createClient } from "@/lib/supabase/client";

export function InvitationRegistration({ token, email }: { token: string; email: string }) {
  const router = useRouter(); const [displayName, setDisplayName] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const next = `/invitations/accept?token=${encodeURIComponent(token)}`;
  async function register(event: React.FormEvent) {
    event.preventDefault(); if (displayName.trim().length < 2) { setError("Enter your name."); return; } if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSaving(true); setError(null);
    try {
      const { data, error: signUpError } = await createClient().auth.signUp({ email, password, options: { data: { display_name: displayName.trim() }, emailRedirectTo: buildAppUrl(`/auth/callback?next=${encodeURIComponent(next)}`) } });
      if (signUpError) { setError(signUpError.message); return; }
      if (data.session) { router.push(next); router.refresh(); return; }
      setError("Check your email to confirm your account. The confirmation link will return you to this invitation.");
    } catch { setError("Unable to create your account."); } finally { setSaving(false); }
  }
  return <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-semibold">Create invited account</h1><p className="mt-2 text-sm text-slate-600">This account is limited to the invited email address.</p><form onSubmit={register} className="mt-5 space-y-4"><label className="block text-sm font-medium">Email<input readOnly value={email} className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2" /></label><label className="block text-sm font-medium">Your name<input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label><label className="block text-sm font-medium">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>{error && <p className="text-sm text-red-700">{error}</p>}<button disabled={saving} className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Creating…" : "Create invited account"}</button></form></div>;
}
