"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import type { OperationalFilters } from "@/lib/berth-planner/operational-filters";
import type { PlannerDomain } from "@/lib/berth-planner/types";

export type ShareViewSnapshot = {
  terminalId: string;
  terminalName: string;
  portName: string;
  startDate: string;
  endDate: string;
  domain: PlannerDomain;
  filters: OperationalFilters;
  berthNames: string[];
};

type CreatedShare = { publicId: string; url: string; expiresAt: string; revoked: boolean };

function FilterSummary({ snapshot }: { snapshot: ShareViewSnapshot }) {
  const filters = snapshot.filters;
  const rows = [
    filters.search && ["Search", filters.search],
    filters.service && ["Service", filters.service],
    filters.status && ["Status", filters.status],
    filters.conflictsOnly && ["Conflicts", "Only conflicting schedules"],
    filters.invalidOnly && ["Placement", "Only incomplete/invalid schedules"],
  ].filter(Boolean) as string[][];
  return rows.length ? <dl className="grid gap-2 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 p-3"><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-900">{value}</dd></div>)}</dl> : <p className="text-sm text-slate-600">No schedule filters. All schedules in the selected berth scope will be visible.</p>;
}

export function ShareViewDialog({ snapshot, onClose }: { snapshot: ShareViewSnapshot | null; onClose: () => void }) {
  const [expirationDays, setExpirationDays] = useState("15");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedShare | null>(null);

  async function createShare() {
    if (!snapshot) return;
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/organization/berth-planner-shares", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminalId: snapshot.terminalId, startDate: snapshot.startDate, endDate: snapshot.endDate, initialView: snapshot.domain, expirationDays: Number(expirationDays), filters: snapshot.filters }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to create share link.");
      setCreated({ ...payload.data, revoked: false });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create share link."); } finally { setCreating(false); }
  }

  async function copyLink() {
    if (!created || created.revoked) return;
    try { await navigator.clipboard.writeText(created.url); } catch { setError("Your browser could not copy the link. Select and copy it manually."); }
  }

  async function revoke() {
    if (!created || created.revoked) return;
    setError("");
    const response = await fetch(`/api/organization/berth-planner-shares/${encodeURIComponent(created.publicId)}/revoke`, { method: "POST" });
    if (!response.ok) { setError("Unable to revoke this link."); return; }
    setCreated({ ...created, revoked: true });
  }

  return <Drawer isOpen={Boolean(snapshot)} title={created ? "Share link created" : "Confirm shared planner view"} description={created ? "This secret link is shown only once." : "Review exactly what external visitors will see."} onRequestClose={onClose} footer={created ? <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={created.revoked} onClick={() => void copyLink()} className="min-h-11 rounded border border-slate-300 px-4 disabled:opacity-40">Copy link</button><button type="button" disabled={created.revoked} onClick={() => window.open(created.url, "_blank", "noopener,noreferrer")} className="min-h-11 rounded border border-blue-600 px-4 text-blue-700 disabled:opacity-40">Open preview</button><button type="button" disabled={created.revoked} onClick={() => void revoke()} className="min-h-11 rounded bg-red-600 px-4 text-white disabled:opacity-40">{created.revoked ? "Revoked" : "Revoke"}</button></div> : <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded border border-slate-300 px-4">Cancel</button><button type="button" disabled={creating} onClick={() => void createShare()} className="min-h-11 rounded bg-blue-600 px-4 font-medium text-white disabled:opacity-50">{creating ? "Creating…" : "Create share link"}</button></div>}>
    {snapshot ? <div className="space-y-5">
      {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {created ? <>
        <div className={`rounded-md border p-4 ${created.revoked ? "border-slate-300 bg-slate-50" : "border-amber-300 bg-amber-50"}`}><p className="font-medium">{created.revoked ? "This link has been revoked." : "Copy this link now. It cannot be reconstructed later."}</p><input readOnly value={created.url} aria-label="Share link" className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"/><p className="mt-2 text-xs text-slate-600">Expires {new Date(created.expiresAt).toLocaleString()}</p></div>
      </> : <>
        <section className="rounded-lg border border-slate-200 p-4"><h3 className="font-semibold">Visible scope</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Terminal</dt><dd className="text-right font-medium">{snapshot.portName} — {snapshot.terminalName}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Berths</dt><dd className="text-right font-medium">{snapshot.berthNames.join(", ")}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Dates</dt><dd className="text-right font-medium">{snapshot.startDate} through {snapshot.endDate}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Initial view</dt><dd className="capitalize font-medium">{snapshot.domain}</dd></div></dl></section>
        <section><h3 className="mb-2 font-semibold">Fixed filters</h3><FilterSummary snapshot={snapshot}/></section>
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">Schedule data remains live inside this fixed scope. Visitors cannot edit, export, or access remarks, internal IDs, users, or audit history.</p>
        <label className="block text-sm font-medium">Link expiry<select value={expirationDays} onChange={(event) => setExpirationDays(event.target.value)} className="mt-1 block h-11 w-full rounded border border-slate-300 px-3"><option value="15">15 days</option><option value="20">20 days</option><option value="30">30 days</option></select></label>
      </>}
    </div> : null}
  </Drawer>;
}
