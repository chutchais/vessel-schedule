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
  createMode: boolean;
  onCreateModeChange: () => void;
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
  createMode,
  onCreateModeChange,
}: BerthPlannerControlsProps) {
  const weekLabel = portTimezone
    ? formatWeekLabel(weekStart, weekEnd, portTimezone)
    : "";

  const tzLabel = portTimezone
    ? formatTimezoneOffset(new Date(), portTimezone)
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 sm:px-4">
      {/* Terminal selector */}
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="planner-terminal">
          Terminal
        </label>
        <select
          id="planner-terminal"
          value={selectedTerminalId}
          onChange={(e) => onTerminalChange(e.target.value)}
          className="block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="min-h-11 min-w-11 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Previous week"
        >
          ‹
        </button>

        <div className="min-w-[160px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-slate-900">{weekLabel}</p>
          {tzLabel && (
            <p className="text-[10px] text-slate-500">{tzLabel}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onNextWeek}
          className="min-h-11 min-w-11 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <button
        type="button"
        onClick={onCurrentWeek}
        className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        This Week
      </button>

      <div className="ml-auto inline-flex rounded-md border border-slate-300 bg-white p-0.5">
        <button
          type="button"
          onClick={() => onDomainChange("position")}
          className={`min-h-10 rounded px-2.5 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            domain === "position" ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Position
        </button>
        <button
          type="button"
          onClick={() => onDomainChange("datetime")}
          className={`min-h-10 rounded px-2.5 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            domain === "datetime" ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Datetime
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onCreateModeChange} aria-pressed={createMode} className={`min-h-11 rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${createMode ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>{createMode ? "Add schedule: on" : "Add schedule"}</button>
        <button type="button" onClick={onPrint} disabled={exportDisabled} className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{exportProgress === "Printing…" ? exportProgress : "Print"}</button>
        <button type="button" onClick={onExportPdf} disabled={exportDisabled} className="min-h-11 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{exportProgress === "Preparing PDF…" ? exportProgress : "Export PDF"}</button>
      </div>
    </div>
  );
}
