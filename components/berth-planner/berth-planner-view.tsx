"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AlertMessage } from "@/components/ui/alert-message";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { BerthPlannerControls } from "./berth-planner-controls";
import { ShareViewDialog, type ShareViewSnapshot } from "./share-view-dialog";
import { BerthPlannerCanvas, type DragDropRequest, type DurationResizeRequest } from "./berth-planner-canvas";
import { DragConfirmDialog } from "./drag-confirm-dialog";
import { ResizeConfirmDialog } from "./resize-confirm-dialog";
import { applyResizeTimes } from "@/lib/berth-planner/duration-resize";
import { ScheduleFormFields, type ScheduleFormValues } from "@/components/schedules/schedule-form-fields";
import {
  getWeekStart,
  getWeekEnd,
  addWeeks,
  formatTimezoneOffset,
} from "@/lib/berth-planner/timezone";
import {
  getBerthConflictWarning,
  getVesselFitError,
  toDateTimeLocalValueInTimezone,
  toIsoUtc,
} from "@/lib/schedules/form-validation";
import { buildEditFormValues, type EditableSchedule } from "@/lib/berth-planner/click-edit";
import {
  readPreferredPlannerDomain,
  switchPlannerDomainPreservingState,
  writePreferredPlannerDomain,
} from "@/lib/berth-planner/view-preference";
import {
  buildConflictGroups,
  getConflictedScheduleIds,
  type ConflictItem,
} from "@/lib/berth-planner/conflict-panel";
import { ConflictPanel } from "./conflict-panel";
import { RecentChangesPanel } from "./recent-changes-panel";
import { OperationalFilterBar } from "./operational-filter-bar";
import {
  EMPTY_OPERATIONAL_FILTERS,
  countSchedules,
  filterPlannerBerths,
  parsePlannerUrlState,
  serializePlannerUrlState,
  type OperationalFilters,
} from "@/lib/berth-planner/operational-filters";
import type { PlannerDataRaw, PlannerBerth, InvalidScheduleRecord, PlannerDomain } from "@/lib/berth-planner/types";
import { highlightForChange, type ChangeHighlight, type PlannerChangeEvent, type PlannerChangesResponse } from "@/lib/berth-planner/realtime";
import { renderWeeklyExport } from "@/lib/berth-planner/weekly-export";
import { recordPlannerPerformance, startPlannerPerformance } from "@/lib/berth-planner/performance";
import { isCompactPlannerLandscape, readControlsCollapsed, writeControlsCollapsed } from "@/lib/berth-planner/planner-layout";
import { defaultVesselLabelConfig } from "@/lib/berth-planner/vessel-label";
import {
  canDecreaseBerthPlannerLabelScale,
  canIncreaseBerthPlannerLabelScale,
  readBerthPlannerLabelScale,
  shiftBerthPlannerLabelScale,
  writeBerthPlannerLabelScale,
  type BerthPlannerLabelScale,
} from "@/lib/berth-planner/label-scale-preference";

const DEFAULT_TIMEZONE = "UTC";

const INITIAL_CREATE_FORM: ScheduleFormValues = {
  vesselId: "",
  serviceId: "",
  voyageNumber: "",
  terminalId: "",
  berthId: "",
  eta: "",
  etb: "",
  etd: "",
  ata: "",
  atb: "",
  atd: "",
  status: "PLANNED",
  remarks: "",
  berthPositionMeters: "",
  headingReverse: false,
};

type TerminalOption = {
  id: string;
  name: string;
  port: { name: string; timezone: string };
};

type Vessel = {
  id: string;
  name: string;
  imo: string | null;
  lengthOverall: number | string | null;
  isActive: boolean;
};

type Terminal = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  port: {
    code: string;
  };
};

type Berth = {
  id: string;
  terminalId: string;
  code: string;
  name: string;
  berthLength: number;
  isActive: boolean;
};

type Service = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type ScheduleRow = {
  id: string;
  berthId: string | null;
  status: string;
  eta: string;
  etb: string | null;
  etd: string;
  berthPositionMeters: number | null;
  vessel: { lengthOverall: number | string | null } | null;
};

type PlannerUndoAction = {
  scheduleId: string;
  token: string;
  expiresAt: string;
  expectedUpdatedAt: string;
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

function dateOnlyInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function BerthPlannerView() {
  const [initialUrlState] = useState(() =>
    parsePlannerUrlState(
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams(),
    ),
  );
  const [terminals, setTerminals] = useState<TerminalOption[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState("");
  const [portTimezone, setPortTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStart(new Date(), DEFAULT_TIMEZONE),
  );
  const weekEnd = getWeekEnd(weekStart, portTimezone);

  const [plannerData, setPlannerData] = useState<PlannerDataRaw | null>(null);
  const [domain, setDomain] = useState<PlannerDomain>(() => {
    return new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").has("view")
      ? initialUrlState.domain
      : readPreferredPlannerDomain(typeof window !== "undefined" ? window.localStorage : null);
  });
  const [filters, setFilters] = useState<OperationalFilters>(initialUrlState.filters);
  const [searchInput, setSearchInput] = useState(initialUrlState.filters.search);
  const [urlStateReady, setUrlStateReady] = useState(false);
  const [filterNotice, setFilterNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invalidRecords, setInvalidRecords] = useState<InvalidScheduleRecord[]>([]);
  const [createSuccess, setCreateSuccess] = useState("");

  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createDataLoading, setCreateDataLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState<ScheduleFormValues>(INITIAL_CREATE_FORM);
  const [createVessels, setCreateVessels] = useState<Vessel[]>([]);
  const [createTerminals, setCreateTerminals] = useState<Terminal[]>([]);
  const [createBerths, setCreateBerths] = useState<Berth[]>([]);
  const [createServices, setCreateServices] = useState<Service[]>([]);
  const [existingSchedules, setExistingSchedules] = useState<ScheduleRow[]>([]);

  // Edit drawer state
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editDataLoading, setEditDataLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState<ScheduleFormValues>(INITIAL_CREATE_FORM);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingUpdatedAt, setEditingUpdatedAt] = useState<string | null>(null);

  // Conflict panel state (preserved across Position/Datetime domain switches)
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const [onlyConflicts, setOnlyConflicts] = useState(initialUrlState.filters.conflictsOnly);
  const [highlightedScheduleIds, setHighlightedScheduleIds] = useState<Set<string>>(new Set());

  // Drag-and-drop confirmation state
  const [dragDropPending, setDragDropPending] = useState<DragDropRequest | null>(null);
  const [isDragConfirmOpen, setIsDragConfirmOpen] = useState(false);
  const [isDragSaving, setIsDragSaving] = useState(false);
  const [dragSaveError, setDragSaveError] = useState("");
  const [resizePending, setResizePending] = useState<DurationResizeRequest | null>(null);
  const [isResizeSaving, setIsResizeSaving] = useState(false);
  const [resizeSaveError, setResizeSaveError] = useState("");
  const [undoAction, setUndoAction] = useState<PlannerUndoAction | null>(null);
  const [undoSaving, setUndoSaving] = useState(false);
  const [undoError, setUndoError] = useState("");
  const [recentChanges, setRecentChanges] = useState<PlannerChangeEvent[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [recentHighlights, setRecentHighlights] = useState<Map<string, ChangeHighlight>>(new Map());
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canvasInteractionActive, setCanvasInteractionActive] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [exportError, setExportError] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(() => readControlsCollapsed(typeof window === "undefined" ? null : window.localStorage));
  const [compactLandscape, setCompactLandscape] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [labelScalePercent, setLabelScalePercent] = useState<BerthPlannerLabelScale>(() =>
    readBerthPlannerLabelScale(typeof window === "undefined" ? null : window.localStorage),
  );
  const [canSharePlanner, setCanSharePlanner] = useState(false);
  const [shareSnapshot, setShareSnapshot] = useState<ShareViewSnapshot | null>(null);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const plannerRequestRef = useRef(0);
  const undoExpiryTimerRef = useRef<number | null>(null);
  const changeCursorRef = useRef<string | null>(null);
  const changeRequestRef = useRef(false);
  const changesContextRef = useRef("");
  const highlightTimersRef = useRef<Map<string, number>>(new Map());

  const showUndoAction = useCallback((scheduleId: string, payload: { undoToken?: string; undoExpiresAt?: string; expectedUpdatedAt?: string }) => {
    if (!payload.undoToken || !payload.undoExpiresAt || !payload.expectedUpdatedAt) return;
    if (undoExpiryTimerRef.current !== null) window.clearTimeout(undoExpiryTimerRef.current);
    setUndoError("");
    setUndoAction({ scheduleId, token: payload.undoToken, expiresAt: payload.undoExpiresAt, expectedUpdatedAt: payload.expectedUpdatedAt });
    undoExpiryTimerRef.current = window.setTimeout(() => setUndoAction(null), Math.max(0, new Date(payload.undoExpiresAt).getTime() - Date.now()));
  }, []);

  const highlightCurrentUserChange = useCallback((scheduleId: string, tone: ChangeHighlight["tone"]) => {
    setRecentHighlights((current) => new Map(current).set(scheduleId, { tone, stronger: false }));
    const previous = highlightTimersRef.current.get(scheduleId);
    if (previous) window.clearTimeout(previous);
    highlightTimersRef.current.set(scheduleId, window.setTimeout(() => {
      setRecentHighlights((current) => { const next = new Map(current); next.delete(scheduleId); return next; });
    }, 5000));
  }, []);

  useEffect(() => () => {
    if (undoExpiryTimerRef.current !== null) window.clearTimeout(undoExpiryTimerRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    async function checkSharingPermission() {
      try {
        const response = await fetch("/api/organization/berth-planner-shares", { cache: "no-store" });
        if (active) setCanSharePlanner(response.ok);
      } catch {
        if (active) setCanSharePlanner(false);
      }
    }
    void checkSharingPermission();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setCompactLandscape(isCompactPlannerLandscape(window.innerWidth, window.innerHeight));
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!compactLandscape) return;
    const timer = window.setTimeout(() => setControlsCollapsed(true), 0);
    return () => window.clearTimeout(timer);
  }, [compactLandscape]);

  useEffect(() => {
    writeControlsCollapsed(window.localStorage, controlsCollapsed);
  }, [controlsCollapsed]);

  useEffect(() => {
    writeBerthPlannerLabelScale(window.localStorage, labelScalePercent);
  }, [labelScalePercent]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("planner-focus-mode", { detail: focusMode }));
    if (focusMode) window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-focus-exit='true']")?.focus());
    return () => { window.dispatchEvent(new CustomEvent("planner-focus-mode", { detail: false })); };
  }, [focusMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !focusMode || document.querySelector("[role='dialog'][aria-modal='true']")) return;
      setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  const isInteractionActive = isCreateDrawerOpen || isEditDrawerOpen || isDragConfirmOpen || Boolean(resizePending) || undoSaving || createSaving || editSaving || isDragSaving || isResizeSaving;

  const loadPlannerData = useCallback(async (terminalId: string, start: Date, end: Date, preserveCurrentData = false) => {
    const performanceStartedAt = startPlannerPerformance();
    const requestId = ++plannerRequestRef.current;
    const params = new URLSearchParams({
      terminalId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    let res: Response;
    try {
      res = await fetch(`/api/berth-planner?${params.toString()}`);
    } catch {
      if (requestId !== plannerRequestRef.current) return;
      setLoadError("Network error");
      if (!preserveCurrentData) setPlannerData(null);
      setIsLoading(false);
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (requestId !== plannerRequestRef.current) return;
      setLoadError((body as { error?: string }).error ?? "Failed to load planner data");
      if (!preserveCurrentData) setPlannerData(null);
      setIsLoading(false);
      return;
    }

    const payload = await res.json();
    if (requestId !== plannerRequestRef.current) return;
    const data = payload.data as PlannerDataRaw;
    if (process.env.NODE_ENV !== "production") {
      recordPlannerPerformance("planner-api-and-client-transform", performanceStartedAt, {
        schedules: data.berths.reduce((total, berth) => total + berth.schedules.length, 0),
        responseBytes: new Blob([JSON.stringify(payload)]).size,
        serverTiming: res.headers.get("server-timing") ?? "",
      });
    }
    const validServices = new Set(data.berths.flatMap((berth) => berth.schedules.map((schedule) => schedule.serviceName).filter(Boolean)));
    const validBerths = new Set(data.berths.map((berth) => berth.id));
    setFilters((current) => ({
      ...current,
      service: current.service && !validServices.has(current.service) ? "" : current.service,
      berthId: current.berthId && !validBerths.has(current.berthId) ? "" : current.berthId,
    }));
    setLoadError(null);
    setPlannerData(data);
    if (!preserveCurrentData) {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        recordPlannerPerformance("planner-initial-render", performanceStartedAt, { schedules: data.berths.reduce((total, berth) => total + berth.schedules.length, 0) });
      }));
    }
    setIsLoading(false);
  }, []);

  const loadCreateData = useCallback(async (): Promise<boolean> => {
    setCreateDataLoading(true);
    try {
      const [schedulesRes, vesselsRes, terminalsRes, berthsRes, servicesRes] = await Promise.all([
        fetch("/api/schedules", { method: "GET", cache: "no-store" }),
        fetch("/api/vessels", { method: "GET", cache: "no-store" }),
        fetch("/api/terminals", { method: "GET", cache: "no-store" }),
        fetch("/api/berths", { method: "GET", cache: "no-store" }),
        fetch("/api/services", { method: "GET", cache: "no-store" }),
      ]);

      const schedulesPayload = (await schedulesRes.json()) as { data?: ScheduleRow[]; error?: string };
      const vesselsPayload = (await vesselsRes.json()) as { data?: Vessel[]; error?: string };
      const terminalsPayload = (await terminalsRes.json()) as { data?: Terminal[]; error?: string };
      const berthsPayload = (await berthsRes.json()) as { data?: Berth[]; error?: string };
      const servicesPayload = (await servicesRes.json()) as { data?: Service[]; error?: string };

      if (!schedulesRes.ok) throw new Error(schedulesPayload.error || "Failed to load schedules");
      if (!vesselsRes.ok) throw new Error(vesselsPayload.error || "Failed to load vessels");
      if (!terminalsRes.ok) throw new Error(terminalsPayload.error || "Failed to load terminals");
      if (!berthsRes.ok) throw new Error(berthsPayload.error || "Failed to load berths");
      if (!servicesRes.ok) throw new Error(servicesPayload.error || "Failed to load services");

      setExistingSchedules(Array.isArray(schedulesPayload.data) ? schedulesPayload.data : []);
      setCreateVessels(Array.isArray(vesselsPayload.data) ? vesselsPayload.data : []);
      setCreateTerminals(Array.isArray(terminalsPayload.data) ? terminalsPayload.data : []);
      setCreateBerths(Array.isArray(berthsPayload.data) ? berthsPayload.data : []);
      setCreateServices(Array.isArray(servicesPayload.data) ? servicesPayload.data : []);
      setCreateError("");
      return true;
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to load schedule form data");
      return false;
    } finally {
      setCreateDataLoading(false);
    }
  }, []);

  const refreshPlanner = useCallback(async () => {
    if (!selectedTerminalId) return;
    setIsRefreshing(true);
    try {
      await loadPlannerData(selectedTerminalId, weekStart, weekEnd, true);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedTerminalId, weekStart, weekEnd, loadPlannerData]);

  const loadChanges = useCallback(async (initial = false) => {
    if (!selectedTerminalId || changeRequestRef.current || (!initial && isInteractionActive)) return;
    changeRequestRef.current = true;
    const performanceStartedAt = startPlannerPerformance();
    if (initial) setChangesLoading(true);
    const params = new URLSearchParams({ terminalId: selectedTerminalId, startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() });
    if (!initial && changeCursorRef.current) params.set("cursor", changeCursorRef.current);
    try {
      const response = await fetch(`/api/berth-planner/changes?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json() as PlannerChangesResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to load recent changes");
      changeCursorRef.current = payload.cursor;
      recordPlannerPerformance(payload.data.length ? "planner-poll-changed" : "planner-poll-no-change", performanceStartedAt, {
        events: payload.data.length,
        serverTiming: response.headers.get("server-timing") ?? "",
      });
      setChangesError(null);
      if (initial) setRecentChanges(payload.data.slice(-50).reverse());
      else if (payload.data.length) {
        setRecentChanges((current) => [...payload.data.slice().reverse(), ...current].slice(0, 50));
        const highlights = new Map<string, ChangeHighlight>();
        for (const event of payload.data) highlights.set(event.scheduleId, highlightForChange(event, false));
        setRecentHighlights((current) => new Map([...current, ...highlights]));
        for (const id of highlights.keys()) {
          const previous = highlightTimersRef.current.get(id); if (previous) window.clearTimeout(previous);
          highlightTimersRef.current.set(id, window.setTimeout(() => setRecentHighlights((current) => { const next = new Map(current); next.delete(id); return next; }), 5000));
        }
        await refreshPlanner();
      }
    } catch (error) { setChangesError(error instanceof Error ? error.message : "Failed to load recent changes"); }
    finally { changeRequestRef.current = false; if (initial) setChangesLoading(false); }
  }, [isInteractionActive, refreshPlanner, selectedTerminalId, weekEnd, weekStart]);

  useEffect(() => {
    const context = `${selectedTerminalId}:${weekStart.toISOString()}:${weekEnd.toISOString()}`;
    if (!selectedTerminalId || changesContextRef.current === context) return;
    changesContextRef.current = context;
    changeCursorRef.current = null; setRecentChanges([]); setRecentHighlights(new Map());
    const timer = window.setTimeout(() => void loadChanges(true), 0);
    return () => window.clearTimeout(timer);
  }, [selectedTerminalId, weekStart, weekEnd, loadChanges]);

  useEffect(() => {
    if (!selectedTerminalId || isInteractionActive) return;
    const timer = window.setTimeout(() => void loadChanges(false), 25_000);
    return () => window.clearTimeout(timer);
  }, [isInteractionActive, loadChanges, recentChanges, selectedTerminalId]);

  useEffect(() => {
    writePreferredPlannerDomain(typeof window !== "undefined" ? window.localStorage : null, domain);
  }, [domain]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) => current.search === searchInput.trim()
        ? current
        : { ...current, search: searchInput.trim() });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

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
          const requestedTerminal = initialUrlState.terminalId;
          const selected = options.find((option) => option.id === requestedTerminal) ?? options[0]!;
          const tz = selected.port.timezone;
          const requestedWeek = initialUrlState.week;
          const initialWeek = requestedWeek
            ? getWeekStart(new Date(`${requestedWeek}T12:00:00.000Z`), tz)
            : getWeekStart(new Date(), tz);
          setSelectedTerminalId(selected.id);
          setPortTimezone(tz);
          setWeekStart(initialWeek);
          setIsLoading(true);
          void loadPlannerData(selected.id, initialWeek, getWeekEnd(initialWeek, tz));
        }
        setUrlStateReady(true);
      } catch {
        setLoadError("Failed to load terminals.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [loadPlannerData, initialUrlState]);

  useEffect(() => {
    if (!urlStateReady) return;
    const week = new Intl.DateTimeFormat("en-CA", {
      timeZone: portTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(weekStart);
    const query = serializePlannerUrlState({
      terminalId: selectedTerminalId,
      week,
      domain,
      filters,
    });
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [urlStateReady, selectedTerminalId, weekStart, portTimezone, domain, filters]);

  const handleDomainChange = useCallback((nextDomain: PlannerDomain) => {
    const performanceStartedAt = startPlannerPerformance();
    setDomain((current) => {
      const switched = switchPlannerDomainPreservingState(
        {
          domain: current,
          selectedTerminalId,
          weekStartIso: weekStart.toISOString(),
          activeScheduleId: null,
        },
        nextDomain,
      );
      return switched.domain;
    });
    window.requestAnimationFrame(() => recordPlannerPerformance("planner-view-switch", performanceStartedAt, { domain: nextDomain }));
  }, [selectedTerminalId, weekStart]);

  function handleTerminalChange(id: string) {
    const term = terminals.find((t) => t.id === id);
    const tz = term?.port.timezone ?? DEFAULT_TIMEZONE;
    const nextWeekStart = getWeekStart(new Date(), tz);
    const nextWeekEnd = getWeekEnd(nextWeekStart, tz);
    setSelectedTerminalId(id);
    setPortTimezone(tz);
    setWeekStart(nextWeekStart);
    setIsLoading(true);
    setLoadError(null);
    setPlannerData(null);
    if (id) {
      void loadPlannerData(id, nextWeekStart, nextWeekEnd);
    }
  }

  function handlePrevWeek() {
    setWeekStart((ws) => {
      const nextWeekStart = addWeeks(ws, -1, portTimezone);
      if (selectedTerminalId) {
        void loadPlannerData(selectedTerminalId, nextWeekStart, getWeekEnd(nextWeekStart, portTimezone));
      }
      return nextWeekStart;
    });
    setIsLoading(true);
    setLoadError(null);
  }

  function handleNextWeek() {
    setWeekStart((ws) => {
      const nextWeekStart = addWeeks(ws, 1, portTimezone);
      if (selectedTerminalId) {
        void loadPlannerData(selectedTerminalId, nextWeekStart, getWeekEnd(nextWeekStart, portTimezone));
      }
      return nextWeekStart;
    });
    setIsLoading(true);
    setLoadError(null);
  }

  function handleCurrentWeek() {
    const nextWeekStart = getWeekStart(new Date(), portTimezone);
    setWeekStart(nextWeekStart);
    setIsLoading(true);
    setLoadError(null);
    if (selectedTerminalId) {
      void loadPlannerData(selectedTerminalId, nextWeekStart, getWeekEnd(nextWeekStart, portTimezone));
    }
  }

  const berths = useMemo(
    () => (plannerData ? parsePlannerBerths(plannerData) : []),
    [plannerData],
  );

  // Conflict groups — computed from domain values, reuses the same engine as the canvas
  const conflictGroups = useMemo(() => {
    const startedAt = startPlannerPerformance();
    const groups = buildConflictGroups(berths);
    recordPlannerPerformance("planner-conflict-calculation", startedAt, { schedules: countSchedules(berths) });
    return groups;
  }, [berths]);
  const conflictedScheduleIds = useMemo(() => getConflictedScheduleIds(conflictGroups), [conflictGroups]);

  const canvasBerths = useMemo(() => {
    const startedAt = startPlannerPerformance();
    const effectiveFilters = { ...filters, conflictsOnly: filters.conflictsOnly || onlyConflicts };
    const result = filterPlannerBerths({ berths, filters: effectiveFilters, conflictedScheduleIds });
    recordPlannerPerformance("planner-search-and-filter", startedAt, { schedules: countSchedules(berths), visible: countSchedules(result) });
    return result;
  }, [berths, filters, onlyConflicts, conflictedScheduleIds]);
  const totalScheduleCount = useMemo(() => countSchedules(berths), [berths]);
  const visibleScheduleCount = useMemo(() => countSchedules(canvasBerths), [canvasBerths]);
  const visibleScheduleIds = useMemo(
    () => new Set(canvasBerths.flatMap((berth) => berth.schedules.map((schedule) => schedule.id))),
    [canvasBerths],
  );
  const serviceOptions = useMemo(() => Array.from(new Set(
    berths.flatMap((berth) => berth.schedules.map((schedule) => schedule.serviceName).filter((name): name is string => Boolean(name))),
  )).sort().map((name) => ({ value: name, label: name })), [berths]);
  const berthOptions = useMemo(
    () => berths.map((berth) => ({ value: berth.id, label: berth.name })),
    [berths],
  );
  const activeFiltersSummary = useMemo(() => {
    const values = [filters.search && `Search: ${filters.search}`, filters.service && `Service: ${filters.service}`, filters.status && `Status: ${filters.status}`, filters.berthId && `Berth: ${berths.find((berth) => berth.id === filters.berthId)?.name ?? filters.berthId}`, (filters.conflictsOnly || onlyConflicts) && "Conflicts only", filters.invalidOnly && "Incomplete placement"];
    return values.filter((value): value is string => Boolean(value)).join("; ") || "None";
  }, [filters, onlyConflicts, berths]);

  const exportPlanner = useCallback((mode: "print" | "pdf") => {
    if (!plannerData || isLoading || isInteractionActive || canvasInteractionActive) return;
    setExportError(""); setExportProgress(mode === "pdf" ? "Preparing PDF…" : "Printing…");
    const performanceStartedAt = startPlannerPerformance();
    try {
      const pages = renderWeeklyExport({
        organizationName: plannerData.organizationName,
        portName: plannerData.portName,
        terminalName: plannerData.terminalName,
        timezone: portTimezone,
        weekStart,
        weekEnd,
        domain,
        filtersSummary: activeFiltersSummary,
        berths: canvasBerths,
        vesselLabelConfig: plannerData.vesselLabelConfig,
        exportTableConfig: plannerData.exportTableConfig,
      });
      // `noopener` makes some browsers return null even when the tab opens, which
      // leaves an export tab blank before its document can be written.
      const popup = window.open("", "_blank");
      if (!popup) throw new Error("Allow pop-ups to print or export the planner.");
      popup.opener = null;
      popup.document.title = `${plannerData.terminalName} weekly planner`;
      popup.document.write(`<!doctype html><title>${plannerData.terminalName} weekly planner</title><style>@page{size:landscape;margin:8mm}body{margin:0}img{width:100%;display:block;break-after:page;page-break-after:always}img:last-child{break-after:auto;page-break-after:auto}</style>${pages.map((page) => `<img alt="Weekly berth planner page" src="${page.toDataURL("image/png")}">`).join("")}`);
      popup.document.close();
      recordPlannerPerformance("planner-pdf-export", performanceStartedAt, { pages: pages.length, schedules: countSchedules(canvasBerths), mode });
      window.setTimeout(() => { popup.focus(); popup.print(); setExportProgress(""); }, 250);
    } catch (error) { setExportProgress(""); setExportError(error instanceof Error ? error.message : "Unable to prepare weekly export."); }
  }, [plannerData, isLoading, isInteractionActive, canvasInteractionActive, portTimezone, weekStart, weekEnd, domain, activeFiltersSummary, canvasBerths]);

  const exportCsv = useCallback(async () => {
    if (!plannerData || isLoading || isInteractionActive || canvasInteractionActive) return;
    setExportError("");
    setExportProgress("Preparing CSV…");
    try {
      const query = new URLSearchParams({
        terminalId: plannerData.terminalId,
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
      });
      if (filters.search) query.set("q", filters.search);
      if (filters.service) query.set("service", filters.service);
      if (filters.status) query.set("status", filters.status);
      if (filters.berthId) query.set("berth", filters.berthId);
      if (filters.conflictsOnly) query.set("conflicts", "1");
      if (filters.invalidOnly) query.set("invalid", "1");

      const response = await fetch(`/api/berth-planner/export-csv?${query.toString()}`);
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "CSV export failed");
      }

      // Extract filename from Content-Disposition header
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "vessel-schedules.csv";

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to export CSV.");
    } finally {
      setExportProgress("");
    }
  }, [plannerData, isLoading, isInteractionActive, canvasInteractionActive, weekStart, weekEnd, filters]);

  const availableVessels = useMemo(
    () => createVessels.filter((vessel) => vessel.isActive),
    [createVessels],
  );
  const availableTerminals = useMemo(
    () => createTerminals.filter((terminal) => terminal.isActive),
    [createTerminals],
  );
  const availableBerths = useMemo(
    () => createBerths.filter((berth) => berth.isActive),
    [createBerths],
  );
  const availableServices = useMemo(
    () => createServices.filter((service) => service.isActive),
    [createServices],
  );
  const formBerths = useMemo(
    () => availableBerths.filter((berth) => berth.terminalId === createForm.terminalId),
    [availableBerths, createForm.terminalId],
  );

  const conflictSchedules = useMemo(
    () =>
      existingSchedules.map((s) => ({
        ...s,
        vesselLoa:
          s.vessel?.lengthOverall != null ? Number(s.vessel.lengthOverall) : null,
      })),
    [existingSchedules],
  );

  const createVesselLoa = useMemo(() => {
    const vessel = createVessels.find((v) => v.id === createForm.vesselId);
    return vessel?.lengthOverall != null ? Number(vessel.lengthOverall) : null;
  }, [createVessels, createForm.vesselId]);

  const fitError = useMemo(
    () => getVesselFitError({ form: createForm, vessels: createVessels, berths: createBerths }),
    [createForm, createVessels, createBerths],
  );
  const conflictWarning = useMemo(
    () => getBerthConflictWarning({ form: createForm, schedules: conflictSchedules, newVesselLoa: createVesselLoa }),
    [createForm, conflictSchedules, createVesselLoa],
  );

  // Edit form derived values
  const editFormBerths = useMemo(
    () => availableBerths.filter((berth) => berth.terminalId === editForm.terminalId),
    [availableBerths, editForm.terminalId],
  );
  const editFitError = useMemo(
    () => getVesselFitError({ form: editForm, vessels: createVessels, berths: createBerths }),
    [editForm, createVessels, createBerths],
  );
  const editVesselLoa = useMemo(() => {
    const vessel = createVessels.find((v) => v.id === editForm.vesselId);
    return vessel?.lengthOverall != null ? Number(vessel.lengthOverall) : null;
  }, [createVessels, editForm.vesselId]);
  const editConflictWarning = useMemo(
    () => getBerthConflictWarning({ form: editForm, schedules: conflictSchedules, excludeScheduleId: editingScheduleId, newVesselLoa: editVesselLoa }),
    [editForm, conflictSchedules, editingScheduleId, editVesselLoa],
  );

  const headerDescription = plannerData
    ? `${plannerData.portName} — ${plannerData.terminalName} · ${formatTimezoneOffset(new Date(), portTimezone)}`
    : "Select a terminal to view the berth planner.";

  const updateCreateForm = useCallback(
    <Field extends keyof ScheduleFormValues>(field: Field, value: ScheduleFormValues[Field]) => {
      if (field === "terminalId") {
        setCreateForm((current) => {
          const hasBerthForTerminal = createBerths.some(
            (berth) => berth.id === current.berthId && berth.terminalId === value,
          );
          return {
            ...current,
            terminalId: value as string,
            berthId: hasBerthForTerminal ? current.berthId : "",
          };
        });
        return;
      }

      setCreateForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [createBerths],
  );

  const closeCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(false);
    setCreateError("");
    setCreateForm(INITIAL_CREATE_FORM);
  }, []);

  const closeEditDrawer = useCallback(() => {
    setIsEditDrawerOpen(false);
    setEditError("");
    setEditingScheduleId(null);
    setEditingUpdatedAt(null);
    setEditForm(INITIAL_CREATE_FORM);
  }, []);

  const handleSelectConflict = useCallback((conflict: ConflictItem) => {
    setSelectedConflictId(conflict.id);
    setHighlightedScheduleIds(new Set([conflict.scheduleAId, conflict.scheduleBId]));
  }, []);

  const handleToggleOnlyConflicts = useCallback(() => {
    setOnlyConflicts((value) => {
      const next = !value;
      setFilters((current) => ({ ...current, conflictsOnly: next }));
      return next;
    });
  }, []);

  const handleDragDropRequest = useCallback((drop: DragDropRequest) => {
    setDragDropPending(drop);
    setDragSaveError("");
    setIsDragConfirmOpen(true);
  }, []);

  const handleDragDropConfirm = useCallback(async () => {
    if (!dragDropPending) return;
    setIsDragSaving(true);
    setDragSaveError("");

    try {
      const scheduleRes = await fetch(`/api/schedules/${dragDropPending.scheduleId}`, { cache: "no-store" });
      if (scheduleRes.status === 404) {
        setDragSaveError("This schedule no longer exists and may have been deleted.");
        setIsDragSaving(false);
        return;
      }
      if (!scheduleRes.ok) {
        const body = await scheduleRes.json() as { error?: string };
        setDragSaveError(body.error ?? "Failed to load schedule");
        setIsDragSaving(false);
        return;
      }

      const payload = await scheduleRes.json() as { data?: EditableSchedule };
      if (!payload.data) {
        setDragSaveError("Failed to load schedule data");
        setIsDragSaving(false);
        return;
      }

      const full = payload.data;

      // Shift all times by the same delta to preserve ETA→ETB→ETD relative ordering
      const originalStart = full.etb ? new Date(full.etb) : new Date(full.eta);
      const timeDeltaMs = dragDropPending.newStartTime.getTime() - originalStart.getTime();

      const newEta = new Date(new Date(full.eta).getTime() + timeDeltaMs).toISOString();
      const newEtb = full.etb ? new Date(new Date(full.etb).getTime() + timeDeltaMs).toISOString() : "";
      const newEtd = new Date(new Date(full.etd).getTime() + timeDeltaMs).toISOString();

      const patchRes = await fetch(`/api/schedules/${dragDropPending.scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId: full.vesselId,
          serviceId: full.serviceId ?? "",
          voyageNumber: full.voyageNumber ?? "",
          terminalId: full.terminalId,
          berthId: dragDropPending.newBerthId,
          eta: newEta,
          etb: newEtb,
          etd: newEtd,
          ata: full.ata ?? "",
          atb: full.atb ?? "",
          atd: full.atd ?? "",
          status: full.status,
          remarks: full.remarks ?? "",
          berthPositionMeters: dragDropPending.newPositionStart,
          headingReverse: full.headingReverse,
          plannerAction: "move",
          expectedUpdatedAt: full.updatedAt,
        }),
      });

      if (patchRes.status === 404) {
        setDragSaveError("This schedule no longer exists.");
        setIsDragSaving(false);
        return;
      }

      if (patchRes.status === 409) {
        const body = await patchRes.json() as { error?: string };
        setDragSaveError(body.error ?? "Berth conflict detected. Another schedule occupies this slot.");
        if ((body.error ?? "").toLowerCase().includes("changed")) await refreshPlanner();
        setIsDragSaving(false);
        return;
      }

      if (!patchRes.ok) {
        const body = await patchRes.json() as { error?: string };
        setDragSaveError(body.error ?? "Failed to save schedule");
        setIsDragSaving(false);
        return;
      }

      const patchPayload = await patchRes.json() as { undoToken?: string; undoExpiresAt?: string; expectedUpdatedAt?: string };
      setIsDragConfirmOpen(false);
      setDragDropPending(null);
      setCreateSuccess("Schedule moved successfully.");
      showUndoAction(dragDropPending.scheduleId, patchPayload);
      highlightCurrentUserChange(dragDropPending.scheduleId, "updated");
      await refreshPlanner();
    } catch {
      setDragSaveError("Network error. Please try again.");
    } finally {
      setIsDragSaving(false);
    }
  }, [dragDropPending, highlightCurrentUserChange, refreshPlanner, showUndoAction]);

  const handleDurationResizeRequest = useCallback((request: DurationResizeRequest) => {
    setResizePending(request);
    setResizeSaveError("");
  }, []);

  const handleDurationResizeConfirm = useCallback(async () => {
    if (!resizePending) return;
    setIsResizeSaving(true);
    setResizeSaveError("");
    try {
      const scheduleRes = await fetch(`/api/schedules/${resizePending.scheduleId}`, { cache: "no-store" });
      if (!scheduleRes.ok) {
        const body = await scheduleRes.json().catch(() => ({})) as { error?: string };
        setResizeSaveError(body.error ?? "This schedule is no longer available.");
        return;
      }
      const payload = await scheduleRes.json() as { data?: EditableSchedule };
      if (!payload.data) {
        setResizeSaveError("Failed to load current schedule data.");
        return;
      }
      const full = payload.data;
      const resized = applyResizeTimes({
        eta: full.eta,
        etb: full.etb,
        etd: full.etd,
        edge: resizePending.edge,
        newStartTime: resizePending.newStartTime,
        newEndTime: resizePending.newEndTime,
      });
      const patchRes = await fetch(`/api/schedules/${resizePending.scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId: full.vesselId,
          serviceId: full.serviceId ?? "",
          voyageNumber: full.voyageNumber ?? "",
          terminalId: full.terminalId,
          berthId: full.berthId ?? "",
          eta: resized.eta,
          etb: resized.etb ?? "",
          etd: resized.etd,
          ata: full.ata ?? "",
          atb: full.atb ?? "",
          atd: full.atd ?? "",
          status: full.status,
          remarks: full.remarks ?? "",
          berthPositionMeters: full.berthPositionMeters,
          headingReverse: full.headingReverse,
          plannerAction: "resize",
          resizeEdge: resizePending.edge,
          expectedUpdatedAt: resizePending.expectedUpdatedAt,
        }),
      });
      const body = await patchRes.json().catch(() => ({})) as { error?: string; undoToken?: string; undoExpiresAt?: string; expectedUpdatedAt?: string };
      if (!patchRes.ok) {
        setResizeSaveError(body.error ?? "Failed to resize schedule.");
        if (patchRes.status === 409 && (body.error ?? "").toLowerCase().includes("changed")) await refreshPlanner();
        return;
      }
      setResizePending(null);
      setCreateSuccess("Schedule duration resized successfully.");
      showUndoAction(resizePending.scheduleId, body);
      highlightCurrentUserChange(resizePending.scheduleId, "updated");
      await refreshPlanner();
    } catch {
      setResizeSaveError("Network error. Please try again.");
    } finally {
      setIsResizeSaving(false);
    }
  }, [highlightCurrentUserChange, resizePending, refreshPlanner, showUndoAction]);

  const handleUndo = useCallback(async () => {
    if (!undoAction || undoSaving || new Date(undoAction.expiresAt).getTime() <= Date.now()) {
      setUndoAction(null);
      return;
    }
    setUndoSaving(true);
    setUndoError("");
    try {
      const response = await fetch(`/api/schedules/${undoAction.scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannerAction: "undo", undoToken: undoAction.token, expectedUpdatedAt: undoAction.expectedUpdatedAt }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setUndoError(body.error ?? "Undo could not be completed.");
        await refreshPlanner();
        return;
      }
      setUndoAction(null);
      setCreateSuccess("Planner change undone.");
      highlightCurrentUserChange(undoAction.scheduleId, "updated");
      await refreshPlanner();
    } catch {
      setUndoError("Network error. The planner was not changed; please try Undo again before it expires.");
    } finally {
      setUndoSaving(false);
    }
  }, [highlightCurrentUserChange, refreshPlanner, undoAction, undoSaving]);

  const updateEditForm = useCallback(
    <Field extends keyof ScheduleFormValues>(field: Field, value: ScheduleFormValues[Field]) => {
      if (field === "terminalId") {
        setEditForm((current) => {
          const hasBerthForTerminal = createBerths.some(
            (berth) => berth.id === current.berthId && berth.terminalId === value,
          );
          return {
            ...current,
            terminalId: value as string,
            berthId: hasBerthForTerminal ? current.berthId : "",
          };
        });
        return;
      }
      setEditForm((current) => ({ ...current, [field]: value }));
    },
    [createBerths],
  );

  const handleEditRequest = useCallback(async (scheduleId: string) => {
    setEditError("");
    setEditDataLoading(true);

    const [dataOk, scheduleRes] = await Promise.all([
      loadCreateData(),
      fetch(`/api/schedules/${scheduleId}`, { cache: "no-store" }),
    ]);

    setEditDataLoading(false);

    if (!dataOk) {
      setEditError("Failed to load form data. Please try again.");
      return;
    }

    if (scheduleRes.status === 404) {
      setEditError("This schedule no longer exists. It may have been deleted. Refreshing planner...");
      await refreshPlanner();
      return;
    }

    if (!scheduleRes.ok) {
      const body = (await scheduleRes.json()) as { error?: string };
      setEditError(body.error ?? "Failed to load schedule");
      return;
    }

    const payload = (await scheduleRes.json()) as { data?: EditableSchedule };
    if (!payload.data) {
      setEditError("Failed to load schedule data");
      return;
    }

    setEditForm(buildEditFormValues(payload.data));
    setEditingScheduleId(scheduleId);
    setEditingUpdatedAt(payload.data.updatedAt ?? null);
    setCreateSuccess("");
    setIsEditDrawerOpen(true);
  }, [loadCreateData, refreshPlanner]);

  const handleEditSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingScheduleId) return;

    setEditError("");
    setCreateSuccess("");

    const etaIso = toIsoUtc(editForm.eta);
    const etdIso = toIsoUtc(editForm.etd);
    const etbIso = toIsoUtc(editForm.etb);
    const ataIso = toIsoUtc(editForm.ata);
    const atbIso = toIsoUtc(editForm.atb);
    const atdIso = toIsoUtc(editForm.atd);

    if (!etaIso) {
      setEditError("ETA is required and must be valid");
      return;
    }
    if (!etdIso) {
      setEditError("ETD is required and must be valid");
      return;
    }
    if (editFitError) {
      setEditError(editFitError);
      return;
    }

    setEditSaving(true);
    try {
      const response = await fetch(`/api/schedules/${editingScheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId: editForm.vesselId,
          serviceId: editForm.serviceId,
          voyageNumber: editForm.voyageNumber,
          terminalId: editForm.terminalId,
          berthId: editForm.berthId,
          eta: etaIso,
          etb: etbIso ?? "",
          etd: etdIso,
          ata: ataIso ?? "",
          atb: atbIso ?? "",
          atd: atdIso ?? "",
          status: editForm.status,
          remarks: editForm.remarks,
          berthPositionMeters: editForm.berthPositionMeters,
          headingReverse: editForm.headingReverse,
          expectedUpdatedAt: editingUpdatedAt,
        }),
      });

      if (response.status === 404) {
        setEditError("This schedule no longer exists. It may have been deleted by another user.");
        return;
      }

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setEditError(payload.error ?? "Failed to update schedule");
        if (response.status === 409 && (payload.error ?? "").toLowerCase().includes("changed")) await refreshPlanner();
        return;
      }

      closeEditDrawer();
      setCreateSuccess("Schedule updated successfully.");
      highlightCurrentUserChange(editingScheduleId, "updated");
      await refreshPlanner();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Failed to save schedule");
    } finally {
      setEditSaving(false);
    }
  }, [editingScheduleId, editingUpdatedAt, editForm, editFitError, closeEditDrawer, highlightCurrentUserChange, refreshPlanner]);

  const handleGridCreateRequest = useCallback(async (draft: {
    berthId: string;
    berthPositionMeters: number;
    plannedStartTime: Date;
  }) => {
    setCreateSuccess("");
    setCreateMode(false);
    await loadCreateData();

    const startInput = toDateTimeLocalValueInTimezone(draft.plannedStartTime, portTimezone);
    const defaultEtd = new Date(draft.plannedStartTime.getTime() + 4 * 60 * 60 * 1000);

    setCreateForm({
      ...INITIAL_CREATE_FORM,
      terminalId: selectedTerminalId,
      berthId: draft.berthId,
      eta: startInput,
      etb: startInput,
      etd: toDateTimeLocalValueInTimezone(defaultEtd, portTimezone),
      berthPositionMeters: String(draft.berthPositionMeters),
    });
    setCreateError("");
    setIsCreateDrawerOpen(true);
  }, [loadCreateData, portTimezone, selectedTerminalId]);

  const handleCreateSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    const etaIso = toIsoUtc(createForm.eta);
    const etdIso = toIsoUtc(createForm.etd);
    const etbIso = toIsoUtc(createForm.etb);
    const ataIso = toIsoUtc(createForm.ata);
    const atbIso = toIsoUtc(createForm.atb);
    const atdIso = toIsoUtc(createForm.atd);

    if (!etaIso) {
      setCreateError("ETA is required and must be valid");
      return;
    }

    if (!etdIso) {
      setCreateError("ETD is required and must be valid");
      return;
    }

    if (fitError) {
      setCreateError(fitError);
      return;
    }

    setCreateSaving(true);
    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId: createForm.vesselId,
          serviceId: createForm.serviceId,
          voyageNumber: createForm.voyageNumber,
          terminalId: createForm.terminalId,
          berthId: createForm.berthId,
          eta: etaIso,
          etb: etbIso ?? "",
          etd: etdIso,
          ata: ataIso ?? "",
          atb: atbIso ?? "",
          atd: atdIso ?? "",
          status: createForm.status,
          remarks: createForm.remarks,
          berthPositionMeters: createForm.berthPositionMeters,
          headingReverse: createForm.headingReverse,
        }),
      });

      const payload = (await response.json()) as { error?: string; data?: { id?: string } };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create schedule");
      }

      closeCreateDrawer();
      setCreateSuccess("Schedule created successfully.");
      if (payload.data?.id) highlightCurrentUserChange(payload.data.id, "created");
      await refreshPlanner();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to save schedule");
    } finally {
      setCreateSaving(false);
    }
  }, [createForm, fitError, closeCreateDrawer, highlightCurrentUserChange, refreshPlanner]);

  const activeFilterCount = [filters.search, filters.service, filters.status, filters.berthId, filters.conflictsOnly, filters.invalidOnly].filter(Boolean).length;

  return (
    <div className={`${focusMode ? "fixed inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-slate-100 p-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]" : "-mb-6"} flex flex-col gap-3`} aria-live={focusMode ? "polite" : undefined}>
      {!focusMode && <PageHeader title="Berth Planner" description={headerDescription} />}
      {focusMode && <span className="sr-only">Planner Focus Mode enabled. Press Escape to exit.</span>}

      {createSuccess ? <AlertMessage type="success" message={createSuccess} /> : null}

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
        domain={domain}
        onDomainChange={handleDomainChange}
        exportDisabled={!plannerData || isLoading || isInteractionActive || canvasInteractionActive || Boolean(exportProgress)}
        exportProgress={exportProgress}
        onPrint={() => exportPlanner("print")}
        onExportPdf={() => exportPlanner("pdf")}
        onExportCsv={exportCsv}
        createMode={createMode}
        onCreateModeChange={() => setCreateMode((current) => !current)}
        controlsCollapsed={controlsCollapsed}
        onToggleControls={() => setControlsCollapsed((current) => !current)}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((current) => {
          const next = !current;
          if (next) setControlsCollapsed(true);
          return next;
        })}
        labelScalePercent={labelScalePercent}
        canDecreaseLabelScale={canDecreaseBerthPlannerLabelScale(labelScalePercent)}
        canIncreaseLabelScale={canIncreaseBerthPlannerLabelScale(labelScalePercent)}
        onDecreaseLabelScale={() => setLabelScalePercent((current) => shiftBerthPlannerLabelScale(current, -1))}
        onResetLabelScale={() => setLabelScalePercent(100)}
        onIncreaseLabelScale={() => setLabelScalePercent((current) => shiftBerthPlannerLabelScale(current, 1))}
        onShareView={canSharePlanner && plannerData && selectedTerminalId && !isLoading ? () => {
          const effectiveFilters = { ...filters, conflictsOnly: filters.conflictsOnly || onlyConflicts };
          const selectedBerths = effectiveFilters.berthId ? berths.filter((berth) => berth.id === effectiveFilters.berthId) : berths;
          setShareSnapshot({
            terminalId: selectedTerminalId,
            terminalName: plannerData.terminalName,
            portName: plannerData.portName,
            startDate: dateOnlyInTimezone(weekStart, portTimezone),
            endDate: dateOnlyInTimezone(new Date(weekEnd.getTime() - 1), portTimezone),
            domain,
            filters: effectiveFilters,
            berthNames: selectedBerths.map((berth) => berth.name),
          });
        } : undefined}
      />

      {!controlsCollapsed && <OperationalFilterBar
        filters={{ ...filters, conflictsOnly: filters.conflictsOnly || onlyConflicts }}
        searchInput={searchInput}
        serviceOptions={serviceOptions}
        berthOptions={berthOptions}
        visibleCount={visibleScheduleCount}
        totalCount={totalScheduleCount}
        onSearchInputChange={setSearchInput}
        onChange={(next) => {
          setFilters(next);
          setOnlyConflicts(next.conflictsOnly);
        }}
        onClear={() => {
          setSearchInput("");
          setFilters(EMPTY_OPERATIONAL_FILTERS);
          setOnlyConflicts(false);
        }}
      />}
      {controlsCollapsed && activeFilterCount > 0 ? <div className="text-xs font-medium text-slate-600" role="status">{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"} · Show controls to edit</div> : null}

      {filterNotice && <div role="status" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{filterNotice}</div>}
      {isRefreshing ? <div role="status" className="text-xs text-slate-500">Updating planner…</div> : null}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {exportError ? <AlertMessage type="error" message={exportError} /> : null}

      <div ref={canvasWrapperRef} className="min-w-0 flex-1">
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
            {totalScheduleCount === 0 && (
              <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm text-slate-600">
                No schedules are planned for this terminal and week.
              </div>
            )}
            {visibleScheduleCount === 0 && totalScheduleCount > 0 && (
              <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm text-slate-600">
                No schedules match the active filters. The seven-day grid remains available for planning.
              </div>
            )}
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
              berths={canvasBerths}
              vesselLabelConfig={plannerData?.vesselLabelConfig ?? defaultVesselLabelConfig()}
              labelScalePercent={labelScalePercent}
              weekStart={weekStart}
              weekEnd={weekEnd}
              portTimezone={portTimezone}
              domain={domain}
              highlightedIds={highlightedScheduleIds.size > 0 ? highlightedScheduleIds : undefined}
              recentHighlights={recentHighlights}
              reducedMotion={reducedMotion}
              visibleScheduleIds={visibleScheduleIds}
              onSelectionHidden={() => {
                setFilterNotice("The selected schedule was cleared because it is hidden by the active filters.");
                window.setTimeout(() => setFilterNotice(""), 4000);
              }}
              onInvalidRecords={setInvalidRecords}
              onGridCreateRequest={handleGridCreateRequest}
              onEditRequest={handleEditRequest}
              onDragDropRequest={handleDragDropRequest}
              onDurationResizeRequest={handleDurationResizeRequest}
              onInteractionChange={setCanvasInteractionActive}
              createMode={createMode}
            />
          </>
        )}
      </div>

      {/* Conflict panel — shown whenever a terminal is selected and data is loaded */}
      {selectedTerminalId && !isLoading && !controlsCollapsed && !focusMode && (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <ConflictPanel groups={conflictGroups} selectedConflictId={selectedConflictId} onSelectConflict={handleSelectConflict} onlyConflicts={onlyConflicts} onToggleOnlyConflicts={handleToggleOnlyConflicts} portTimezone={portTimezone} />
          <RecentChangesPanel changes={recentChanges} loading={changesLoading} error={changesError} portTimezone={portTimezone} visibleScheduleIds={visibleScheduleIds} onFocus={(id) => setHighlightedScheduleIds(new Set([id]))} onNotice={setFilterNotice} />
        </div>
      )}

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
      {shareSnapshot ? <ShareViewDialog snapshot={shareSnapshot} onClose={() => setShareSnapshot(null)} /> : null}

      <Drawer
        isOpen={isCreateDrawerOpen}
        title="Create Schedule"
        description="Add vessel schedule from berth planner."
        onRequestClose={closeCreateDrawer}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={closeCreateDrawer} disabled={createSaving}>
              Cancel
            </Button>
            <Button type="submit" form="planner-create-schedule-form" disabled={createSaving || createDataLoading}>
              {createSaving ? "Creating..." : "Create Schedule"}
            </Button>
          </div>
        )}
      >
        {createError ? <AlertMessage type="error" message={createError} className="mb-4" /> : null}

        <form id="planner-create-schedule-form" onSubmit={handleCreateSubmit}>
          <ScheduleFormFields
            form={createForm}
            saving={createSaving || createDataLoading}
            availableVessels={availableVessels}
            availableServices={availableServices}
            availableTerminals={availableTerminals}
            formBerths={formBerths}
            fitError={fitError ?? undefined}
            conflictWarning={conflictWarning ?? undefined}
            onChange={updateCreateForm}
          />
        </form>
      </Drawer>

      <Drawer
        isOpen={isEditDrawerOpen}
        title="Edit Schedule"
        description="Update vessel schedule details."
        onRequestClose={closeEditDrawer}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={closeEditDrawer} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="submit" form="planner-edit-schedule-form" disabled={editSaving || editDataLoading}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      >
        {editError ? <AlertMessage type="error" message={editError} className="mb-4" /> : null}
        {editDataLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading schedule…</p>
        ) : (
          <form id="planner-edit-schedule-form" onSubmit={handleEditSubmit}>
            <ScheduleFormFields
              form={editForm}
              saving={editSaving}
              availableVessels={availableVessels}
              availableServices={availableServices}
              availableTerminals={availableTerminals}
              formBerths={editFormBerths}
              fitError={editFitError ?? undefined}
              conflictWarning={editConflictWarning ?? undefined}
              onChange={updateEditForm}
            />
          </form>
        )}
      </Drawer>

      {dragDropPending && (
        <DragConfirmDialog
          isOpen={isDragConfirmOpen}
          vesselName={dragDropPending.vesselName}
          oldBerthName={dragDropPending.originalBerthName}
          oldPositionStart={dragDropPending.originalPositionStart}
          oldStartTime={dragDropPending.originalStartTime}
          oldEndTime={dragDropPending.originalEndTime}
          newBerthName={dragDropPending.newBerthName}
          newPositionStart={dragDropPending.newPositionStart}
          newStartTime={dragDropPending.newStartTime}
          newEndTime={dragDropPending.newEndTime}
          portTimezone={portTimezone}
          isSaving={isDragSaving}
          saveError={dragSaveError}
          onConfirm={handleDragDropConfirm}
          onCancel={() => {
            setIsDragConfirmOpen(false);
            setDragDropPending(null);
            setDragSaveError("");
          }}
        />
      )}
      {resizePending && (
        <ResizeConfirmDialog
          isOpen
          vesselName={resizePending.vesselName}
          oldStartTime={resizePending.originalStartTime}
          oldEndTime={resizePending.originalEndTime}
          newStartTime={resizePending.newStartTime}
          newEndTime={resizePending.newEndTime}
          portTimezone={portTimezone}
          isSaving={isResizeSaving}
          saveError={resizeSaveError}
          onConfirm={handleDurationResizeConfirm}
          onCancel={() => {
            setResizePending(null);
            setResizeSaveError("");
          }}
        />
      )}
      {undoAction && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-md items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg" role="status">
          <p className="text-sm text-slate-700">Planner change saved.</p>
          <Button variant="secondary" onClick={handleUndo} disabled={undoSaving}>
            {undoSaving ? "Undoing..." : "Undo"}
          </Button>
        </div>
      )}
      {undoError ? <AlertMessage type="error" message={undoError} className="fixed bottom-4 right-4 z-50 max-w-md shadow-lg" /> : null}
    </div>
  );
}
