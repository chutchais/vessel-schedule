"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BerthPlannerCanvas } from "./berth-planner-canvas";
import { toLocalMidnight, formatDateTime, formatTimezoneOffset } from "@/lib/berth-planner/timezone";
import type { PlannerBerth, PlannerDomain, ScheduleStatus, ZeroOriginSide } from "@/lib/berth-planner/types";
import type { VesselLabelConfig } from "@/lib/berth-planner/vessel-label";

type Payload = {
  organizationName: string; terminalName: string; portName: string; portTimezone: string;
  startDate: string; endDate: string; rangeStart: string; rangeEnd: string; initialView: PlannerDomain;
  vesselLabelConfig: VesselLabelConfig;
  berths: Array<{ key: string; name: string; berthLength: number; color: string; zeroOriginSide: ZeroOriginSide; order: number; schedules: Array<{ key: string; vesselName: string; vesselLoa: number | null; voyageNumber: string | null; serviceName: string | null; serviceColor: string | null; eta: string; etb: string | null; etd: string; berthPositionMeters: number | null; headingReverse: boolean; status: ScheduleStatus }> }>;
};

function dateAtOffset(dateOnly: string, offset: number, timezone: string) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + offset));
  return toLocalMidnight(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), timezone);
}

export function PublicBerthPlanner({ publicId }: { publicId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<PlannerDomain>("position");
  const [dayOffset, setDayOffset] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch(`/api/public/berth-planner/${encodeURIComponent(publicId)}/data`, { cache: "no-store" });
    if (!response.ok) throw new Error("This shared planner is unavailable or has expired.");
    const payload = await response.json() as { data: Payload };
    setData(payload.data); setDomain(payload.data.initialView);
  }, [publicId]);

  useEffect(() => {
    let active = true;
    async function authenticate() {
      try {
        const fragment = window.location.hash.slice(1);
        if (fragment) {
          const response = await fetch(`/api/public/berth-planner/${encodeURIComponent(publicId)}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: fragment }) });
          if (!response.ok) throw new Error("This shared planner is unavailable or has expired.");
          window.history.replaceState(null, "", window.location.pathname);
        }
        await load();
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "This shared planner is unavailable.");
      } finally { if (active) setLoading(false); }
    }
    void authenticate(); return () => { active = false; };
  }, [load, publicId]);

  const berths = useMemo<PlannerBerth[]>(() => data?.berths.map((berth) => ({ id: berth.key, name: berth.name, berthLength: berth.berthLength, zeroOriginSide: berth.zeroOriginSide, order: berth.order, schedules: berth.schedules.map((schedule) => ({ id: schedule.key, berthId: berth.key, vesselName: schedule.vesselName, vesselLoa: schedule.vesselLoa, vesselColor: "#3B82F6", serviceName: schedule.serviceName, serviceColor: schedule.serviceColor, status: schedule.status, eta: new Date(schedule.eta), etb: schedule.etb ? new Date(schedule.etb) : null, etd: new Date(schedule.etd), berthPositionMeters: schedule.berthPositionMeters, headingReverse: schedule.headingReverse, voyageNumber: schedule.voyageNumber })) })) ?? [], [data]);
  const rangeStart = data ? dateAtOffset(data.startDate, dayOffset, data.portTimezone) : new Date();
  const rangeLimit = data ? new Date(data.rangeEnd) : new Date();
  const sevenDayEnd = data ? dateAtOffset(data.startDate, dayOffset + 7, data.portTimezone) : new Date();
  const rangeEnd = sevenDayEnd < rangeLimit ? sevenDayEnd : rangeLimit;
  const totalDays = data ? Math.round((Date.parse(`${data.endDate}T00:00:00Z`) - Date.parse(`${data.startDate}T00:00:00Z`)) / 86_400_000) + 1 : 1;
  const canPrevious = dayOffset > 0;
  const canNext = dayOffset + 7 < totalDays;

  if (loading) return <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center p-6"><p>Opening shared planner…</p></main>;
  if (error || !data) return <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6"><div className="rounded-lg border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-semibold">Shared planner unavailable</h1><p className="mt-2 text-slate-600">{error}</p></div></main>;

  return <main className="mx-auto min-h-screen max-w-[1600px] p-3 sm:p-5">
    <header className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-blue-700">Read-only shared berth planner</p>
      <h1 className="text-2xl font-bold text-slate-950">{data.terminalName}</h1>
      <p className="text-sm text-slate-600">{data.organizationName} · {data.portName} · {formatTimezoneOffset(rangeStart, data.portTimezone)}</p>
      <p className="mt-1 text-sm text-slate-600">Shared range: {data.startDate} through {data.endDate}</p>
    </header>
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
      <button type="button" disabled={!canPrevious} onClick={() => setDayOffset((v) => Math.max(0, v - 7))} className="min-h-11 rounded border border-slate-300 px-4 disabled:opacity-40">Previous</button>
      <div className="min-w-64 flex-1 text-center text-sm font-medium">{formatDateTime(rangeStart, data.portTimezone)} – {formatDateTime(new Date(rangeEnd.getTime() - 1), data.portTimezone)}</div>
      <button type="button" disabled={!canNext} onClick={() => setDayOffset((v) => Math.min(totalDays - 1, v + 7))} className="min-h-11 rounded border border-slate-300 px-4 disabled:opacity-40">Next</button>
      <div className="inline-flex rounded border border-slate-300 p-0.5">
        {(["position", "datetime"] as PlannerDomain[]).map((view) => <button key={view} type="button" onClick={() => setDomain(view)} className={`min-h-10 rounded px-3 capitalize ${domain === view ? "bg-blue-600 text-white" : "text-slate-700"}`}>{view}</button>)}
      </div>
    </div>
    <section className="rounded-xl border border-slate-200 bg-white p-2 sm:p-4">
      <BerthPlannerCanvas berths={berths} vesselLabelConfig={data.vesselLabelConfig} labelScalePercent={100} weekStart={rangeStart} weekEnd={rangeEnd} portTimezone={data.portTimezone} domain={domain} onInvalidRecords={() => undefined} showAuditHistory={false} />
    </section>
  </main>;
}
