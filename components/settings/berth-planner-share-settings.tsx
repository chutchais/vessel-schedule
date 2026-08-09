"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Terminal = { id: string; name: string; port: { name: string } };
type Share = { publicId: string; startDate: string; endDate: string; initialView: string; expiresAt: string; revokedAt: string | null; lastAccessedAt: string | null; createdAt: string; terminal: { name: string; port: { name: string } }; createdBy: { displayName: string } };

export function BerthPlannerShareSettings() {
  const today = new Date().toISOString().slice(0, 10);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [createdUrl, setCreatedUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ terminalId: "", startDate: today, endDate: today, initialView: "position", expirationDays: "15", search: "", status: "" });

  const load = useCallback(async () => {
    const [terminalResponse, shareResponse] = await Promise.all([fetch("/api/terminals?isActive=true"), fetch("/api/organization/berth-planner-shares", { cache: "no-store" })]);
    if (shareResponse.status === 404) { setAvailable(false); return; }
    if (!terminalResponse.ok || !shareResponse.ok) throw new Error("Unable to load planner sharing settings.");
    const terminalPayload = await terminalResponse.json(); const sharePayload = await shareResponse.json();
    const list = terminalPayload.data as Terminal[]; setTerminals(list); setShares(sharePayload.data);
    setForm((current) => ({ ...current, terminalId: current.terminalId || list[0]?.id || "" }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load settings."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setCreatedUrl("");
    try {
      const response = await fetch("/api/organization/berth-planner-shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, expirationDays: Number(form.expirationDays), filters: { search: form.search, status: form.status } }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to create share link.");
      setCreatedUrl(payload.data.url); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create share link."); } finally { setSaving(false); }
  }

  async function revoke(publicId: string) {
    if (!window.confirm("Revoke this share link? Existing viewer sessions will stop immediately.")) return;
    const response = await fetch(`/api/organization/berth-planner-shares/${encodeURIComponent(publicId)}/revoke`, { method: "POST" });
    if (!response.ok) { setError("Unable to revoke share link."); return; } await load();
  }

  if (!available) return <section><h2 className="text-xl font-semibold">Berth Planner sharing</h2><p className="mt-2 text-sm text-slate-600">Planner sharing is currently unavailable.</p></section>;
  return <section className="space-y-5">
    <div><h2 className="text-xl font-semibold">Berth Planner sharing</h2><p className="text-sm text-slate-600">Create expiring, read-only links. The link secret is shown once.</p></div>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {createdUrl && <div className="rounded-md border border-amber-300 bg-amber-50 p-4"><p className="font-medium">Copy this link now—it cannot be recovered later.</p><div className="mt-2 flex gap-2"><input readOnly value={createdUrl} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2"/><button type="button" onClick={() => void navigator.clipboard.writeText(createdUrl)} className="rounded bg-blue-600 px-4 text-white">Copy</button></div></div>}
    <form onSubmit={create} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
      <label className="text-sm">Terminal<select required value={form.terminalId} onChange={(e) => setForm({ ...form, terminalId: e.target.value })} className="mt-1 block h-11 w-full rounded border border-slate-300 px-2">{terminals.map((t) => <option key={t.id} value={t.id}>{t.port.name} — {t.name}</option>)}</select></label>
      <label className="text-sm">Start date<input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1 block h-11 w-full rounded border border-slate-300 px-2"/></label>
      <label className="text-sm">End date<input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1 block h-11 w-full rounded border border-slate-300 px-2"/></label>
      <label className="text-sm">Initial view<select value={form.initialView} onChange={(e) => setForm({ ...form, initialView: e.target.value })} className="mt-1 block h-11 w-full rounded border border-slate-300 px-2"><option value="position">Position</option><option value="datetime">Datetime</option></select></label>
      <label className="text-sm">Expires in<select value={form.expirationDays} onChange={(e) => setForm({ ...form, expirationDays: e.target.value })} className="mt-1 block h-11 w-full rounded border border-slate-300 px-2"><option value="15">15 days</option><option value="20">20 days</option><option value="30">30 days</option></select></label>
      <label className="text-sm">Search filter<input value={form.search} maxLength={100} onChange={(e) => setForm({ ...form, search: e.target.value })} className="mt-1 block h-11 w-full rounded border border-slate-300 px-2" placeholder="Vessel or voyage"/></label>
      <label className="text-sm">Status filter<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 block h-11 w-full rounded border border-slate-300 px-2"><option value="">All statuses</option>{["PLANNED","CONFIRMED","ARRIVED","BERTHED","DEPARTED","CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <div className="flex items-end"><button disabled={saving || !form.terminalId} className="h-11 rounded bg-blue-600 px-5 font-medium text-white disabled:opacity-50">{saving ? "Creating…" : "Create share link"}</button></div>
    </form>
    <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Terminal</th><th className="p-3">Range</th><th className="p-3">Expires</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{shares.map((share) => <tr key={share.publicId} className="border-t border-slate-200"><td className="p-3">{share.terminal.port.name} — {share.terminal.name}</td><td className="p-3">{share.startDate} – {share.endDate}</td><td className="p-3">{new Date(share.expiresAt).toLocaleString()}</td><td className="p-3">{share.revokedAt ? "Revoked" : new Date(share.expiresAt) <= new Date() ? "Expired" : "Active"}</td><td className="p-3"><button type="button" disabled={Boolean(share.revokedAt)} onClick={() => void revoke(share.publicId)} className="text-red-700 disabled:text-slate-400">Revoke</button></td></tr>)}</tbody></table></div>
  </section>;
}
