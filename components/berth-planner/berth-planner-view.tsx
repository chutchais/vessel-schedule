"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { BerthPlannerControls } from "./berth-planner-controls";
import { BerthPlannerCanvas } from "./berth-planner-canvas";
import {
  getWeekStart,
  getWeekEnd,
  addWeeks,
  formatTimezoneOffset,
} from "@/lib/berth-planner/timezone";
import type { PlannerDataRaw, PlannerBerth, InvalidScheduleRecord } from "@/lib/berth-planner/types";

// Fallback timezone until a terminal is selected
const DEFAULT_TIMEZONE = "UTC";

type TerminalOption = {
  id: string;
  name: string;
  port: { name: string; timezone: string };
};

function parsePlannerBerths(raw: PlannerDataRaw): PlannerBerth[] {
  return raw.berths.map((b) => ({
    ...b,
    schedules: b.schedules.map((s) => ({
      ...s,
      eta: new Date(s.eta),
      etb: s.etb ? new Date(s.etb) : null,
      etd: new Date(s.etd),
    })),
  }));
}

export function BerthPlannerView() {
  const [terminals, setTerminals] = useState<TerminalOption[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState("");

  // portTimezone is set once a terminal is loaded
  const [portTimezone, setPortTimezone] = useState<string>(DEFAULT_TIMEZONE);

  // Week state: weekStart is Monday 00:00 in port timezone
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStart(new Date(), DEFAULT_TIMEZONE),
  );
  const weekEnd = getWeekEnd(weekStart, portTimezone);

  const [plannerData, setPlannerData] = useState<PlannerDataRaw | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invalidRecords, setInvalidRecords] = useState<InvalidScheduleRecord[]>([]);

  // Ref to calculate available canvas height
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // ── Load terminals on mount ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/terminals?isActive=true");
        if (!res.ok || !active) return;
        const payload = await res.json();
        if (!active) return;

        const list = (payload.data ?? []) as Array<{
          id: string;
          name: string;
          port: { name: string; timezone?: string | null };
        }>;

        const options: TerminalOption[] = list.map((t) => ({
          id: t.id,
          name: t.name,
          port: { name: t.port.name, timezone: t.port.timezone ?? "UTC" },
        }));

        setTerminals(options);

        if (options.length > 0) {
          const first = options[0]!;
          const tz = first.port.timezone;
          setSelectedTerminalId(first.id);
          setPortTimezone(tz);
          setWeekStart(getWeekStart(new Date(), tz));
          setIsLoading(true);
        }
      } catch {
        // silently ignore
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  // ── Fetch planner data when terminal or week changes ─────────────────────
  useEffect(() => {
    if (!selectedTerminalId) return;

    let active = true;

    async function load() {
      const params = new URLSearchParams({
        terminalId: selectedTerminalId,
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
      });

      let res: Response;
      try {
        res = await fetch(`/api/berth-planner?${params.toString()}`);
      } catch {
        if (active) { setLoadError("Network error"); setPlannerData(null); setIsLoading(false); }
        return;
      }

      if (!active) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (!active) return;
        setLoadError((body as { error?: string }).error ?? "Failed to load planner data");
        setPlannerData(null);
        setIsLoading(false);
        return;
      }

      const payload = await res.json();
      if (!active) return;

      setLoadError(null);
      setPlannerData(payload.data as PlannerDataRaw);
      setIsLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [selectedTerminalId, weekStart, weekEnd]);

  // ── Event handlers (set isLoading synchronously — safe in event handlers) ─
  function handleTerminalChange(id: string) {
    const term = terminals.find((t) => t.id === id);
    const tz = term?.port.timezone ?? DEFAULT_TIMEZONE;
    setSelectedTerminalId(id);
    setPortTimezone(tz);
    setWeekStart(getWeekStart(new Date(), tz));
    setIsLoading(true);
    setLoadError(null);
    setPlannerData(null);
  }

  function handlePrevWeek() {
    setWeekStart((ws) => addWeeks(ws, -1, portTimezone));
    setIsLoading(true);
    setLoadError(null);
  }

  function handleNextWeek() {
    setWeekStart((ws) => addWeeks(ws, 1, portTimezone));
    setIsLoading(true);
    setLoadError(null);
  }

  function handleCurrentWeek() {
    setWeekStart(getWeekStart(new Date(), portTimezone));
    setIsLoading(true);
    setLoadError(null);
  }

  const berths = useMemo(
    () => (plannerData ? parsePlannerBerths(plannerData) : []),
    [plannerData],
  );

  const headerDescription = plannerData
    ? `${plannerData.portName} — ${plannerData.terminalName} · ${formatTimezoneOffset(new Date(), portTimezone)}`
    : "Select a terminal to view the berth planner.";

  return (
    <div className="-mb-6 flex flex-col gap-3">
      <PageHeader title="Berth Planner" description={headerDescription} />

      <BerthPlannerControls
        terminals={terminals}
        selectedTerminalId={selectedTerminalId}
        onTerminalChange={handleTerminalChange}
        weekStart={weekStart}
        weekEnd={weekEnd}
        portTimezone={portTimezone !== DEFAULT_TIMEZONE ? portTimezone : null}
        onPrevWeek={handlePrevWeek}
        onCurrentWeek={handleCurrentWeek}
        onNextWeek={handleNextWeek}
      />

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Canvas wrapper – fills remaining viewport height */}
      <div ref={canvasWrapperRef} className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16">
            <p className="text-sm text-slate-500">Loading planner data…</p>
          </div>
        ) : !selectedTerminalId ? (
          <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16">
            <p className="text-sm text-slate-500">Select a terminal to view the berth planner.</p>
          </div>
        ) : (
          <>
            {/* Accessible non-canvas summary */}
            <div className="sr-only">
              <h2>Schedule summary</h2>
              {berths.map((berth) => (
                <section key={berth.id}>
                  <h3>{berth.name}</h3>
                  <ul>
                    {berth.schedules.map((s) => (
                      <li key={s.id}>
                        {s.vesselName} — {s.status} — ETA: {s.eta.toISOString()} — ETD: {s.etd.toISOString()}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <BerthPlannerCanvas
              berths={berths}
              weekStart={weekStart}
              weekEnd={weekEnd}
              portTimezone={portTimezone}
              onInvalidRecords={setInvalidRecords}
            />
          </>
        )}
      </div>

      {invalidRecords.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-1 text-sm font-semibold text-amber-800">
            Schedules not shown ({invalidRecords.length})
          </h2>
          <p className="mb-2 text-xs text-amber-700">
            Correct these in the Vessel Schedules page.
          </p>
          <ul className="space-y-0.5">
            {invalidRecords.map((r) => (
              <li key={r.scheduleId} className="text-xs text-amber-800">
                <span className="font-medium">{r.vesselName}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
