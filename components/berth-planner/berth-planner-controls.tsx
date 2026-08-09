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
  onExportCsv: () => void;
  createMode: boolean;
  onCreateModeChange: () => void;
  controlsCollapsed: boolean;
  onToggleControls: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  labelScalePercent: number;
  canDecreaseLabelScale: boolean;
  canIncreaseLabelScale: boolean;
  onDecreaseLabelScale: () => void;
  onResetLabelScale: () => void;
  onIncreaseLabelScale: () => void;
  onShareView?: () => void;
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
  onExportCsv,
  createMode,
  onCreateModeChange,
  controlsCollapsed,
  onToggleControls,
  focusMode,
  onToggleFocusMode,
  labelScalePercent,
  canDecreaseLabelScale,
  canIncreaseLabelScale,
  onDecreaseLabelScale,
  onResetLabelScale,
  onIncreaseLabelScale,
  onShareView,
}: BerthPlannerControlsProps) {
  const weekLabel = portTimezone
    ? formatWeekLabel(weekStart, weekEnd, portTimezone)
    : "";

  const tzLabel = portTimezone
    ? formatTimezoneOffset(new Date(), portTimezone)
    : null;

  const renderLabelSizeControls = () => (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white p-1">
      <span className="px-2 text-xs font-medium text-slate-600">Label size</span>
      <button
        type="button"
        onClick={onDecreaseLabelScale}
        disabled={!canDecreaseLabelScale}
        aria-label="Decrease vessel label size"
        className="min-h-11 min-w-11 rounded-md border border-slate-300 px-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        A−
      </button>
      <button
        type="button"
        onClick={onResetLabelScale}
        aria-label="Reset vessel label size to 100%"
        title="Reset on-screen vessel labels to 100%. PDF export keeps print-optimized sizing."
        className="min-h-11 min-w-11 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {labelScalePercent}%
      </button>
      <button
        type="button"
        onClick={onIncreaseLabelScale}
        disabled={!canIncreaseLabelScale}
        aria-label="Increase vessel label size"
        className="min-h-11 min-w-11 rounded-md border border-slate-300 px-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        A+
      </button>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 sm:px-3">
      <p className="sr-only" role="status" aria-live="polite">Vessel label size {labelScalePercent}%</p>
      {/* Terminal selector */}
      <div className="min-w-[180px] flex-1">
        <label className="sr-only" htmlFor="planner-terminal">Terminal</label>
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

        <div className="hidden min-w-[160px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center sm:block">
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

      <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
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
      <div className="hidden xl:flex">{renderLabelSizeControls()}</div>
      <div className="ml-auto flex items-center gap-2">
        {onShareView ? <button type="button" onClick={onShareView} className="min-h-11 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Share view</button> : null}
        <button type="button" onClick={onToggleControls} aria-expanded={!controlsCollapsed} aria-controls="planner-secondary-controls" className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{controlsCollapsed ? "Show controls" : "Hide controls"}</button>
        <button data-focus-exit={focusMode ? "true" : undefined} type="button" onClick={onToggleFocusMode} aria-pressed={focusMode} className="min-h-11 rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{focusMode ? "Exit Focus" : "Focus Mode"}</button>
      </div>
      {!controlsCollapsed && (
      <div id="planner-secondary-controls" className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        <div className="xl:hidden">{renderLabelSizeControls()}</div>
        <button type="button" onClick={onCreateModeChange} aria-pressed={createMode} className={`min-h-11 rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${createMode ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>{createMode ? "Add schedule: on" : "Add schedule"}</button>
        <button type="button" onClick={onPrint} disabled={exportDisabled} className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{exportProgress === "Printing…" ? exportProgress : "Print"}</button>
        <button type="button" onClick={onExportPdf} disabled={exportDisabled} className="min-h-11 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{exportProgress === "Preparing PDF…" ? exportProgress : "Export PDF"}</button>
        <button type="button" onClick={onExportCsv} disabled={exportDisabled} className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{exportProgress === "Preparing CSV…" ? exportProgress : "Export CSV"}</button>
      </div>
      )}
    </div>
  );
}
