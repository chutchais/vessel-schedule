"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type State = { status: "LOADING" | "INVALID" | "EXPIRED" | "REVOKED" | "ACCEPTED" | "ACTIVE"; invitedEmail?: string; signedInEmail?: string | null; accountExists?: boolean };
const statusText: Record<string, string> = { INVALID: "This invitation link is invalid.", EXPIRED: "This invitation has expired.", REVOKED: "This invitation has been revoked or replaced.", ACCEPTED: "This invitation has already been accepted." };

export function InvitationAcceptance({ token }: { token: string }) {
  const router = useRouter(); const [state, setState] = useState<State>({ status: token ? "LOADING" : "INVALID" }); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const next = `/invitations/accept?token=${encodeURIComponent(token)}`;
  useEffect(() => { if (!token) return; fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", token }) }).then(async (response) => setState(await response.json() as State)).catch(() => setState({ status: "INVALID" })); }, [token]);
  async function accept() { setSaving(true); setError(null); try { const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const body = await response.json() as { success?: boolean; error?: string }; if (body.success) { router.push("/"); router.refresh(); return; } setError(body.error ?? "Unable to accept invitation."); } catch { setError("Unable to accept invitation."); } finally { setSaving(false); } }
  async function signOut() { setSaving(true); await createClient().auth.signOut(); router.replace(next); router.refresh(); }
  if (state.status === "LOADING") return <div className="w-full max-w-md rounded-xl bg-white p-8 text-sm text-slate-600">Checking invitation…</div>;
  if (state.status !== "ACTIVE") return <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-semibold">Invitation unavailable</h1><p className="mt-3 text-sm text-slate-600">{statusText[state.status]}</p></div>;
  const signedOut = !state.signedInEmail; const matches = state.signedInEmail === state.invitedEmail;
  return <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-semibold">Join organization</h1><p className="mt-2 text-sm text-slate-600">Invitation for <strong>{state.invitedEmail}</strong>.</p>{signedOut ? <div className="mt-6 grid grid-cols-2 gap-3">{state.accountExists ? <Link href={`/login?next=${encodeURIComponent(next)}`} className="col-span-2 rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white">Sign in</Link> : <><Link href={`/invitations/register?token=${encodeURIComponent(token)}`} className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white">Create invited account</Link><Link href={`/login?next=${encodeURIComponent(next)}`} className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium">Sign in</Link></>}</div> : matches ? <><button onClick={() => void accept()} disabled={saving} className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Accepting…" : "Accept invitation"}</button>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}</> : <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><p>This invitation is for <strong>{state.invitedEmail}</strong>, but you are signed in as <strong>{state.signedInEmail}</strong>.</p><button onClick={() => void signOut()} disabled={saving} className="mt-3 rounded-md border border-amber-400 px-3 py-1.5 font-medium">Sign out and use the invited email</button></div>}</div>;
}
