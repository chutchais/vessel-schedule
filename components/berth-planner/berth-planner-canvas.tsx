"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { timeToPixel } from "@/lib/berth-planner/scales";
import { getVesselPolygon, isPointInsidePolygon } from "@/lib/berth-planner/geometry";
import { classifySchedules } from "@/lib/berth-planner/layout";
import { detectConflicts } from "@/lib/berth-planner/conflicts";
import {
  formatTime,
  formatDate,
  getMidnightsBetween,
  get4HourMarks,
} from "@/lib/berth-planner/timezone";
import { ScheduleTooltip } from "./schedule-tooltip";
import { ScheduleDetailsDrawer } from "./schedule-details-drawer";
import type {
  PlannerBerth,
  ValidatedSchedule,
  InvalidScheduleRecord,
} from "@/lib/berth-planner/types";

// Canvas layout constants
const LEFT_AXIS_W = 62; // pixels reserved for time labels on the left (wider for 2-line midnight labels)
const TOP_HEADER_H = 52; // pixels reserved for berth names + meter labels at top
const BOTTOM_PAD = 4; // small bottom gap
const MIN_CANVAS_H = 320; // minimum canvas height in px


type HitTarget = {
  scheduleId: string;
  polygon: [number, number][];
  schedule: ValidatedSchedule;
  berthName: string;
  berthOffset: number;
  berthLength: number;
  isConflict: boolean;
};

type TooltipState = {
  x: number;
  y: number;
  schedule: ValidatedSchedule;
  berthName: string;
  isConflict: boolean;
};

type ConflictPairInfo = {
  scheduleAId: string;
  scheduleBId: string;
  aName: string;
  bName: string;
};

export type BerthPlannerCanvasProps = {
  berths: PlannerBerth[];
  weekStart: Date;
  weekEnd: Date;
  portTimezone: string;
  onInvalidRecords: (records: InvalidScheduleRecord[]) => void;
};

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? [parseInt(r[1]!, 16), parseInt(r[2]!, 16), parseInt(r[3]!, 16)]
    : [59, 130, 246];
}

export function BerthPlannerCanvas({
  berths,
  weekStart,
  weekEnd,
  portTimezone,
  onInvalidRecords,
}: BerthPlannerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitTargetsRef = useRef<HitTarget[]>([]);

  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(500);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ValidatedSchedule | null>(null);
  const [selectedBerthName, setSelectedBerthName] = useState("");
  const [selectedConflictPartners, setSelectedConflictPartners] = useState<string[]>([]);

  // ── Derived: classify + detect conflicts ──────────────────────────────────
  const classifiedBerths = berths.map((berth) => {
    const { valid, invalid } = classifySchedules(berth.schedules, berth.berthLength);
    return { berth, valid, invalid };
  });

  const [conflictedIds, conflictPairs] = useMemo<[Set<string>, ConflictPairInfo[]]>(() => {
    const ids = new Set<string>();
    const pairs: ConflictPairInfo[] = [];
    for (const { valid } of classifiedBerths) {
      const { conflictedIds: cids, pairs: cpairs } = detectConflicts(valid);
      for (const id of cids) ids.add(id);
      for (const p of cpairs) {
        const a = valid.find((s) => s.id === p.scheduleAId);
        const b = valid.find((s) => s.id === p.scheduleBId);
        if (a && b)
          pairs.push({ scheduleAId: p.scheduleAId, scheduleBId: p.scheduleBId, aName: a.vesselName, bName: b.vesselName });
      }
    }
    return [ids, pairs];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berths]);

  // ── Report invalid records ────────────────────────────────────────────────
  useEffect(() => {
    const all = berths.flatMap((b) => classifySchedules(b.schedules, b.berthLength).invalid);
    onInvalidRecords(all);
  }, [berths, onInvalidRecords]);

  // ── ResizeObserver: track container size ──────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setCanvasWidth(Math.max(400, width));

        // Height: always fill from this element's top to viewport bottom
        const rect = el.getBoundingClientRect();
        setCanvasHeight(Math.max(MIN_CANVAS_H, window.innerHeight - rect.top));
      }
    });

    observer.observe(el);

    // Initial size
    const rect = el.getBoundingClientRect();
    setCanvasWidth(Math.max(400, el.clientWidth));
    setCanvasHeight(Math.max(MIN_CANVAS_H, window.innerHeight - rect.top));

    return () => observer.disconnect();
  }, []);

  // ── Canvas drawing ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const drawW = canvasWidth - LEFT_AXIS_W;
    const drawH = canvasHeight - TOP_HEADER_H - BOTTOM_PAD;
    if (drawW <= 0 || drawH <= 0) return;

    // Total berth length (sum of all berth lengths)
    const totalLength = berths.reduce((s, b) => s + b.berthLength, 0);

    // Helpers (safe even when totalLength === 0)
    const toX = (globalM: number) =>
      totalLength > 0 ? LEFT_AXIS_W + (globalM / totalLength) * drawW : LEFT_AXIS_W;
    const toY = (t: Date) => TOP_HEADER_H + timeToPixel(t, weekStart, weekEnd, drawH);

    const midnights = getMidnightsBetween(weekStart, weekEnd, portTimezone);
    const hourMarks = get4HourMarks(weekStart, weekEnd, portTimezone);

    // ── Background ────────────────────────────────────────────────────────
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Main plot area background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(LEFT_AXIS_W, TOP_HEADER_H, drawW, drawH);

    // ── Horizontal time grid ─────────────────────────────────────────────
    // 4-hour interval lines (light)
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 0.5;
    for (const mark of hourMarks) {
      // Skip marks that coincide with midnights (drawn separately)
      const isMidnight = midnights.some((mn) => Math.abs(mn.getTime() - mark.getTime()) < 60000);
      if (isMidnight) continue;
      const y = toY(mark);
      if (y < TOP_HEADER_H || y > TOP_HEADER_H + drawH) continue;
      ctx.beginPath();
      ctx.moveTo(LEFT_AXIS_W, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    // Daily midnight lines (bold)
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1;
    for (const midnight of midnights) {
      const y = toY(midnight);
      if (y < TOP_HEADER_H || y > TOP_HEADER_H + drawH) continue;
      ctx.beginPath();
      ctx.moveTo(LEFT_AXIS_W, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    // ── Vertical position grid ────────────────────────────────────────────
    // 50-metre bold lines (across all berths, in global metres)
    if (totalLength > 0) {
      for (let gm = 0; gm <= totalLength; gm += 10) {
        const isBold = gm % 50 === 0;
        ctx.strokeStyle = isBold ? "#CBD5E1" : "#EEF2F7";
        ctx.lineWidth = isBold ? 0.75 : 0.5;
        const x = toX(gm);
        ctx.beginPath();
        ctx.moveTo(x, TOP_HEADER_H);
        ctx.lineTo(x, TOP_HEADER_H + drawH);
        ctx.stroke();
      }
    }

    // Cumulative offsets for each berth (in metres from the left)
    const berthOffsets: number[] = [];
    {
      let acc = 0;
      for (const berth of berths) {
        berthOffsets.push(acc);
        acc += berth.berthLength;
      }
    }

    // ── Empty-state overlay (no berths) ──────────────────────────────────
    if (totalLength === 0) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
      ctx.fillRect(LEFT_AXIS_W, TOP_HEADER_H, drawW, drawH);
      ctx.fillStyle = "#64748B";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No active berths configured for this terminal.", LEFT_AXIS_W + drawW / 2, TOP_HEADER_H + drawH / 2);
    }

    // ── Berth boundaries (most prominent) ────────────────────────────────
    berths.forEach((berth, i) => {
      const offset = berthOffsets[i]!;
      const leftX = toX(offset);
      const rightX = toX(offset + berth.berthLength);

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      // Left boundary
      ctx.beginPath();
      ctx.moveTo(leftX, TOP_HEADER_H - 2);
      ctx.lineTo(leftX, TOP_HEADER_H + drawH);
      ctx.stroke();
      // Right boundary (only for last berth; intermediate ones share with next berth's left)
      if (i === berths.length - 1) {
        ctx.beginPath();
        ctx.moveTo(rightX, TOP_HEADER_H - 2);
        ctx.lineTo(rightX, TOP_HEADER_H + drawH);
        ctx.stroke();
      }

      // Berth name in header
      const cx = (leftX + rightX) / 2;
      ctx.fillStyle = "#1E293B";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(berth.name, cx, TOP_HEADER_H / 2 - 6, rightX - leftX - 8);
    });

    // ── Meter labels in header ────────────────────────────────────────────
    berths.forEach((berth, i) => {
      const offset = berthOffsets[i]!;

      // Determine tick marks in berth's NATIVE coordinate system
      // Always draw 0 and berthLength, then multiples of 50m in between
      const tickValues = new Set<number>([0, berth.berthLength]);
      for (let m = 50; m < berth.berthLength; m += 50) tickValues.add(m);

      ctx.fillStyle = "#64748B";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textBaseline = "bottom";

      for (const native of tickValues) {
        // Convert native coordinate to global X
        let globalM: number;
        if (berth.zeroOriginSide === "LEFT") {
          globalM = offset + native;
        } else {
          // RIGHT origin: 0 is at the right end of the berth
          globalM = offset + (berth.berthLength - native);
        }
        const x = toX(globalM);
        ctx.textAlign = native === berth.berthLength && berth.zeroOriginSide === "LEFT"
          ? "right"
          : "center";
        ctx.fillText(`${native}`, x, TOP_HEADER_H - 2);
      }
    });

    // ── Left axis: time labels ────────────────────────────────────────────
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, TOP_HEADER_H, LEFT_AXIS_W, drawH);

    ctx.textAlign = "right";

    // Date label at each midnight line — centred on the line
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (const midnight of midnights) {
      const y = toY(midnight);
      if (y < TOP_HEADER_H || y > TOP_HEADER_H + drawH) continue;
      ctx.fillStyle = "#1E293B";
      ctx.fillText(formatDate(midnight, portTimezone), LEFT_AXIS_W - 4, y);
    }

    // 4-hour labels — centred on their grid line
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.textBaseline = "middle";
    for (const mark of hourMarks) {
      const isMidnight = midnights.some((mn) => Math.abs(mn.getTime() - mark.getTime()) < 60000);
      if (isMidnight) continue;
      const y = toY(mark);
      if (y < TOP_HEADER_H || y > TOP_HEADER_H + drawH) continue;
      ctx.fillText(formatTime(mark, portTimezone), LEFT_AXIS_W - 4, y);
    }

    // ── Current-time indicator ────────────────────────────────────────────
    const now = new Date();
    if (now > weekStart && now < weekEnd) {
      const nowY = toY(now);
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(LEFT_AXIS_W, nowY);
      ctx.lineTo(canvasWidth, nowY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Red "Now" label
      ctx.fillStyle = "#EF4444";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("Now", LEFT_AXIS_W + 3, nowY - 1);
    }

    // ── Week boundary lines ───────────────────────────────────────────────
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    // Top boundary
    ctx.beginPath();
    ctx.moveTo(LEFT_AXIS_W, TOP_HEADER_H);
    ctx.lineTo(canvasWidth, TOP_HEADER_H);
    ctx.stroke();

    // ── Vessel polygons ───────────────────────────────────────────────────
    const newHitTargets: HitTarget[] = [];

    classifiedBerths.forEach(({ berth, valid }, bi) => {
      const offset = berthOffsets[bi]!;

      for (const schedule of valid) {
        const isConflict = conflictedIds.has(schedule.id);
        const isSelected = selectedSchedule?.id === schedule.id;

        // Convert berth-native position to global metres
        let leftGlobal: number;
        let rightGlobal: number;
        if (berth.zeroOriginSide === "LEFT") {
          leftGlobal = offset + schedule.positionStart;
          rightGlobal = offset + schedule.positionEnd;
        } else {
          // RIGHT origin: positionStart is distance from the RIGHT edge
          rightGlobal = offset + berth.berthLength - schedule.positionStart;
          leftGlobal = offset + berth.berthLength - schedule.positionEnd;
        }

        const leftPx = toX(leftGlobal);
        const rightPx = toX(rightGlobal);
        const topPy = toY(schedule.startTime);
        const bottomPy = toY(schedule.endTime);

        const pw = rightPx - leftPx;
        const ph = bottomPy - topPy;

        if (pw < 1 || ph < 1) continue;

        // Determine bow (head) and stern (tail) X positions.
        // headingReverse=false → bow faces the origin side of the berth.
        // For LEFT origin, origin is left (smaller X). For RIGHT origin, origin is right (larger X).
        let xHead: number;
        let xTail: number;
        if (berth.zeroOriginSide === "LEFT") {
          xHead = schedule.headingReverse ? rightPx : leftPx;
          xTail = schedule.headingReverse ? leftPx : rightPx;
        } else {
          // RIGHT origin: origin is the right edge
          xHead = schedule.headingReverse ? leftPx : rightPx;
          xTail = schedule.headingReverse ? rightPx : leftPx;
        }

        const polygon = getVesselPolygon(xHead, xTail, topPy, bottomPy);
        const [r, g, b] = hexToRgb(schedule.serviceColor ?? schedule.vesselColor);

        ctx.beginPath();
        ctx.moveTo(...polygon[0]!);
        for (let vi = 1; vi < polygon.length; vi++) ctx.lineTo(...polygon[vi]!);
        ctx.closePath();

        if (schedule.status === "CANCELLED") {
          ctx.fillStyle = "rgba(148,163,184,0.25)";
          ctx.strokeStyle = "#CBD5E1";
          ctx.setLineDash([3, 2]);
        } else if (isConflict) {
          ctx.fillStyle = `rgba(${r},${g},${b},0.2)`;
          ctx.strokeStyle = "#EF4444";
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
          ctx.strokeStyle = `rgb(${r},${g},${b})`;
          ctx.setLineDash([]);
        }

        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        // Selection ring
        if (isSelected) {
          ctx.strokeStyle = "#1D4ED8";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(...polygon[0]!);
          for (let vi = 1; vi < polygon.length; vi++) ctx.lineTo(...polygon[vi]!);
          ctx.closePath();
          ctx.stroke();
        }

        // Conflict badge
        if (isConflict && schedule.status !== "CANCELLED") {
          ctx.fillStyle = "#EF4444";
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("⚠", leftPx + pw / 2, topPy + 2);
        }

        // Vessel name (only if shape is tall enough)
        if (ph >= 14 && pw >= 16) {
          ctx.fillStyle = schedule.status === "CANCELLED" ? "#94A3B8" : "#1E293B";
          const fontSize = Math.min(11, Math.max(8, Math.min(pw / 6, ph / 3)));
          ctx.font = `${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(...polygon[0]!);
          for (let vi = 1; vi < polygon.length; vi++) ctx.lineTo(...polygon[vi]!);
          ctx.closePath();
          ctx.clip();
          ctx.fillText(schedule.vesselName, leftPx + pw / 2, topPy + ph / 2, pw - 4);
          ctx.restore();
        }

        newHitTargets.push({
          scheduleId: schedule.id,
          polygon,
          schedule,
          berthName: berth.name,
          berthOffset: offset,
          berthLength: berth.berthLength,
          isConflict,
        });
      }
    });

    hitTargetsRef.current = newHitTargets;
  }, [
    canvasWidth,
    canvasHeight,
    berths,
    weekStart,
    weekEnd,
    portTimezone,
    selectedSchedule,
    conflictedIds,
    classifiedBerths,
  ]);

  // ── Hit testing ───────────────────────────────────────────────────────────
  function findHit(clientX: number, clientY: number): HitTarget | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (let i = hitTargetsRef.current.length - 1; i >= 0; i--) {
      const t = hitTargetsRef.current[i]!;
      if (isPointInsidePolygon(x, y, t.polygon)) return t;
    }
    return null;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const t = findHit(e.clientX, e.clientY);
    if (t) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, schedule: t.schedule, berthName: t.berthName, isConflict: t.isConflict });
    } else {
      setTooltip(null);
    }
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const t = findHit(e.clientX, e.clientY);
    if (t) {
      setSelectedSchedule(t.schedule);
      setSelectedBerthName(t.berthName);
      const partners = conflictPairs
        .filter((p) => p.scheduleAId === t.scheduleId || p.scheduleBId === t.scheduleId)
        .map((p) => (p.scheduleAId === t.scheduleId ? p.bName : p.aName));
      setSelectedConflictPartners(partners);
    } else {
      setSelectedSchedule(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (e.key === "Escape") setSelectedSchedule(null);
  }

  return (
    <div className="relative flex flex-col gap-2">
      {conflictedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
          <span className="font-semibold">⚠</span>
          <span>
            {conflictedIds.size} vessel{conflictedIds.size !== 1 ? "s" : ""} have berth conflicts.
          </span>
        </div>
      )}

      <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-label="Berth planner canvas. Hover over vessels to see details."
          className="block cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />

        {tooltip && (
          <ScheduleTooltip
            x={tooltip.x}
            y={tooltip.y}
            vesselName={tooltip.schedule.vesselName}
            serviceName={tooltip.schedule.serviceName}
            status={tooltip.schedule.status}
            startTime={tooltip.schedule.startTime}
            endTime={tooltip.schedule.endTime}
            positionStart={tooltip.schedule.positionStart}
            positionEnd={tooltip.schedule.positionEnd}
            berthName={tooltip.berthName}
            timezone={portTimezone}
            isConflict={tooltip.isConflict}
            headingReverse={tooltip.schedule.headingReverse}
          />
        )}
      </div>

      <ScheduleDetailsDrawer
        schedule={selectedSchedule}
        berthName={selectedBerthName}
        isConflict={selectedSchedule ? conflictedIds.has(selectedSchedule.id) : false}
        conflictingVessels={selectedConflictPartners}
        timezone={portTimezone}
        onClose={() => setSelectedSchedule(null)}
      />
    </div>
  );
}
