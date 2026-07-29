"use client";

import { formatWeekLabel, formatTimezoneOffset } from "@/lib/berth-planner/timezone";
import type { PlannerDomain } from "@/lib/berth-planner/types";

type Terminal = {
  id: string;
  name: string;
  port: { name: string; timezone: string };
};

type BerthPlannerControlsProps = {
  terminals: Terminal[];
  selectedTerminalId: string;
  onTerminalChange: (id: string) => void;
  weekStart: Date;
  weekEnd: Date;
  portTimezone: string | null;
  onPrevWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
  domain: PlannerDomain;
  onDomainChange: (domain: PlannerDomain) => void;
  exportDisabled: boolean;
  exportProgress: string;
  onPrint: () => void;
  onExportPdf: () => void;
};

export function BerthPlannerControls({
  terminals,
  selectedTerminalId,
  onTerminalChange,
  weekStart,
  weekEnd,
  portTimezone,
  onPrevWeek,
  onCurrentWeek,
  onNextWeek,
  domain,
  onDomainChange,
  exportDisabled,
  exportProgress,
  onPrint,
  onExportPdf,
}: BerthPlannerControlsProps) {
  const weekLabel = portTimezone
    ? formatWeekLabel(weekStart, weekEnd, portTimezone)
    : "";

  const tzLabel = portTimezone
    ? formatTimezoneOffset(new Date(), portTimezone)
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      {/* Terminal selector */}
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="planner-terminal">
          Terminal
        </label>
        <select
          id="planner-terminal"
          value={selectedTerminalId}
          onChange={(e) => onTerminalChange(e.target.value)}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Select terminal —</option>
          {terminals.map((t) => (
            <option key={t.id} value={t.id}>
              {t.port.name} — {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Week label + navigation */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevWeek}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Previous week"
        >
          ‹
        </button>

        <div className="min-w-[160px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
          <p className="text-xs font-semibold text-slate-900">{weekLabel}</p>
          {tzLabel && (
            <p className="text-[10px] text-slate-500">{tzLabel}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onNextWeek}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <button
        type="button"
        onClick={onCurrentWeek}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        This Week
      </button>

      <div className="ml-auto inline-flex rounded-md border border-slate-300 bg-white p-0.5">
        <button
          type="button"
          onClick={() => onDomainChange("position")}
          className={`rounded px-2.5 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            domain === "position" ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Position
        </button>
        <button
          type="button"
          onClick={() => onDomainChange("datetime")}
          className={`rounded px-2.5 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            domain === "datetime" ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Datetime
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onPrint} disabled={exportDisabled} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{exportProgress === "Printing…" ? exportProgress : "Print"}</button>
        <button type="button" onClick={onExportPdf} disabled={exportDisabled} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{exportProgress === "Preparing PDF…" ? exportProgress : "Export PDF"}</button>
      </div>
    </div>
  );
}
