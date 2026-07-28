"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { timeToPixel } from "@/lib/berth-planner/scales";
import {
  getVesselPolygon,
  getVesselPolygonVertical,
  isPointInsidePolygon,
} from "@/lib/berth-planner/geometry";
import { classifySchedules } from "@/lib/berth-planner/layout";
import { detectConflicts } from "@/lib/berth-planner/conflicts";
import {
  formatTime,
  formatDate,
  getMidnightsBetween,
  get4HourMarks,
} from "@/lib/berth-planner/timezone";
import {
  convertCanvasClickToCreateSelectionByDomain,
  isGridAreaClick,
  shouldHandleCreateClick,
} from "@/lib/berth-planner/click-create";
import {
  buildDatetimeBerthLanes,
  positionToDatetimeLaneY,
  type DatetimeBerthLane,
} from "@/lib/berth-planner/datetime-domain";
import { ScheduleTooltip } from "./schedule-tooltip";
import { ScheduleDetailsDrawer } from "./schedule-details-drawer";
import type {
  PlannerBerth,
  ValidatedSchedule,
  InvalidScheduleRecord,
  PlannerDomain,
} from "@/lib/berth-planner/types";

const LEFT_AXIS_W = 62;
const TOP_HEADER_H = 52;
const BOTTOM_PAD = 4;
const MIN_CANVAS_H = 320;

type HitTarget = {
  scheduleId: string;
  polygon: [number, number][];
  schedule: ValidatedSchedule;
  berthName: string;
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
  domain: PlannerDomain;
  onInvalidRecords: (records: InvalidScheduleRecord[]) => void;
  onGridCreateRequest?: (draft: {
    berthId: string;
    berthPositionMeters: number;
    plannedStartTime: Date;
  }) => void;
  onEditRequest?: (scheduleId: string) => void;
};

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? [parseInt(r[1]!, 16), parseInt(r[2]!, 16), parseInt(r[3]!, 16)]
    : [59, 130, 246];
}

function drawPath(ctx: CanvasRenderingContext2D, polygon: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(...polygon[0]!);
  for (let vi = 1; vi < polygon.length; vi++) ctx.lineTo(...polygon[vi]!);
  ctx.closePath();
}

function drawVesselShape(params: {
  ctx: CanvasRenderingContext2D;
  polygon: [number, number][];
  schedule: ValidatedSchedule;
  isConflict: boolean;
  isSelected: boolean;
  bounds: { left: number; right: number; top: number; bottom: number };
}) {
  const { ctx, polygon, schedule, isConflict, isSelected, bounds } = params;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const [r, g, b] = hexToRgb(schedule.serviceColor ?? schedule.vesselColor);

  drawPath(ctx, polygon);
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

  if (isSelected) {
    ctx.strokeStyle = "#1D4ED8";
    ctx.lineWidth = 2.5;
    drawPath(ctx, polygon);
    ctx.stroke();
  }

  if (isConflict && schedule.status !== "CANCELLED") {
    ctx.fillStyle = "#EF4444";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("⚠", bounds.left + width / 2, bounds.top + 2);
  }

  if (height >= 14 && width >= 16) {
    ctx.fillStyle = schedule.status === "CANCELLED" ? "#94A3B8" : "#1E293B";
    const fontSize = Math.min(11, Math.max(8, Math.min(width / 6, height / 3)));
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.save();
    drawPath(ctx, polygon);
    ctx.clip();
    ctx.fillText(schedule.vesselName, bounds.left + width / 2, bounds.top + height / 2, width - 4);
    ctx.restore();
  }
}

export function BerthPlannerCanvas({
  berths,
  weekStart,
  weekEnd,
  portTimezone,
  domain,
  onInvalidRecords,
  onGridCreateRequest,
  onEditRequest,
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

  const classifiedBerths = useMemo(
    () => berths.map((berth) => {
      const { valid, invalid } = classifySchedules(berth.schedules, berth.berthLength);
      return { berth, valid, invalid };
    }),
    [berths],
  );

  const [conflictedIds, conflictPairs] = useMemo<[Set<string>, ConflictPairInfo[]]>(() => {
    const ids = new Set<string>();
    const pairs: ConflictPairInfo[] = [];
    for (const { valid } of classifiedBerths) {
      const { conflictedIds: cids, pairs: cpairs } = detectConflicts(valid);
      for (const id of cids) ids.add(id);
      for (const p of cpairs) {
        const a = valid.find((s) => s.id === p.scheduleAId);
        const b = valid.find((s) => s.id === p.scheduleBId);
        if (a && b) {
          pairs.push({
            scheduleAId: p.scheduleAId,
            scheduleBId: p.scheduleBId,
            aName: a.vesselName,
            bName: b.vesselName,
          });
        }
      }
    }
    return [ids, pairs];
  }, [classifiedBerths]);

  useEffect(() => {
    const all = classifiedBerths.flatMap((x) => x.invalid);
    onInvalidRecords(all);
  }, [classifiedBerths, onInvalidRecords]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setCanvasWidth(Math.max(400, width));
        const rect = el.getBoundingClientRect();
        setCanvasHeight(Math.max(MIN_CANVAS_H, window.innerHeight - rect.top));
      }
    });

    observer.observe(el);
    const rect = el.getBoundingClientRect();
    setCanvasWidth(Math.max(400, el.clientWidth));
    setCanvasHeight(Math.max(MIN_CANVAS_H, window.innerHeight - rect.top));
    return () => observer.disconnect();
  }, []);

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

    const midnights = getMidnightsBetween(weekStart, weekEnd, portTimezone);
    const hourMarks = get4HourMarks(weekStart, weekEnd, portTimezone);

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(LEFT_AXIS_W, TOP_HEADER_H, drawW, drawH);

    const newHitTargets: HitTarget[] = [];

    if (domain === "position") {
      const totalLength = berths.reduce((s, b) => s + b.berthLength, 0);
      const toX = (globalM: number) =>
        totalLength > 0 ? LEFT_AXIS_W + (globalM / totalLength) * drawW : LEFT_AXIS_W;
      const toY = (t: Date) => TOP_HEADER_H + timeToPixel(t, weekStart, weekEnd, drawH);

      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 0.5;
      for (const mark of hourMarks) {
        const isMidnight = midnights.some((mn) => Math.abs(mn.getTime() - mark.getTime()) < 60_000);
        if (isMidnight) continue;
        const y = toY(mark);
        if (y < TOP_HEADER_H || y > TOP_HEADER_H + drawH) continue;
        ctx.beginPath();
        ctx.moveTo(LEFT_AXIS_W, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }

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

      const berthOffsets: number[] = [];
      let acc = 0;
      for (const berth of berths) {
        berthOffsets.push(acc);
        acc += berth.berthLength;
      }

      if (totalLength === 0) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
        ctx.fillRect(LEFT_AXIS_W, TOP_HEADER_H, drawW, drawH);
        ctx.fillStyle = "#64748B";
        ctx.font = "13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No active berths configured for this terminal.", LEFT_AXIS_W + drawW / 2, TOP_HEADER_H + drawH / 2);
      }

      berths.forEach((berth, i) => {
        const offset = berthOffsets[i]!;
        const leftX = toX(offset);
        const rightX = toX(offset + berth.berthLength);

        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftX, TOP_HEADER_H - 2);
        ctx.lineTo(leftX, TOP_HEADER_H + drawH);
        ctx.stroke();
        if (i === berths.length - 1) {
          ctx.beginPath();
          ctx.moveTo(rightX, TOP_HEADER_H - 2);
          ctx.lineTo(rightX, TOP_HEADER_H + drawH);
          ctx.stroke();
        }

        const cx = (leftX + rightX) / 2;
        ctx.fillStyle = "#1E293B";
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(berth.name, cx, TOP_HEADER_H / 2 - 6, rightX - leftX - 8);
      });

      berths.forEach((berth, i) => {
        const offset = berthOffsets[i]!;
        const tickValues = new Set<number>([0, berth.berthLength]);
        for (let m = 50; m < berth.berthLength; m += 50) tickValues.add(m);

        ctx.fillStyle = "#64748B";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textBaseline = "bottom";

        for (const native of tickValues) {
          const globalM = berth.zeroOriginSide === "LEFT"
            ? offset + native
            : offset + (berth.berthLength - native);
          const x = toX(globalM);
          ctx.textAlign = native === berth.berthLength && berth.zeroOriginSide === "LEFT" ? "right" : "center";
          ctx.fillText(`${native}`, x, TOP_HEADER_H - 2);
        }
      });

      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, TOP_HEADER_H, LEFT_AXIS_W, drawH);
      ctx.textAlign = "right";

      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      for (const midnight of midnights) {
        const y = toY(midnight);
        if (y < TOP_HEADER_H || y > TOP_HEADER_H + drawH) continue;
        ctx.fillStyle = "#1E293B";
        ctx.fillText(formatDate(midnight, portTimezone), LEFT_AXIS_W - 4, y);
      }

      ctx.font = "9px system-ui, sans-serif";
      ctx.fillStyle = "#94A3B8";
      ctx.textBaseline = "middle";
      for (const mark of hourMarks) {
        const isMidnight = midnights.some((mn) => Math.abs(mn.getTime() - mark.getTime()) < 60_000);
        if (isMidnight) continue;
        const y = toY(mark);
        if (y < TOP_HEADER_H || y > TOP_HEADER_H + drawH) continue;
        ctx.fillText(formatTime(mark, portTimezone), LEFT_AXIS_W - 4, y);
      }

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

        ctx.fillStyle = "#EF4444";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText("Now", LEFT_AXIS_W + 3, nowY - 1);
      }

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(LEFT_AXIS_W, TOP_HEADER_H);
      ctx.lineTo(canvasWidth, TOP_HEADER_H);
      ctx.stroke();

      classifiedBerths.forEach(({ berth, valid }, bi) => {
        const offset = berthOffsets[bi]!;
        for (const schedule of valid) {
          const isConflict = conflictedIds.has(schedule.id);
          const isSelected = selectedSchedule?.id === schedule.id;

          const leftGlobal = berth.zeroOriginSide === "LEFT"
            ? offset + schedule.positionStart
            : offset + berth.berthLength - schedule.positionEnd;
          const rightGlobal = berth.zeroOriginSide === "LEFT"
            ? offset + schedule.positionEnd
            : offset + berth.berthLength - schedule.positionStart;

          const leftPx = toX(leftGlobal);
          const rightPx = toX(rightGlobal);
          const topPy = toY(schedule.startTime);
          const bottomPy = toY(schedule.endTime);
          if (rightPx - leftPx < 1 || bottomPy - topPy < 1) continue;

          const xHead = berth.zeroOriginSide === "LEFT"
            ? (schedule.headingReverse ? rightPx : leftPx)
            : (schedule.headingReverse ? leftPx : rightPx);
          const xTail = berth.zeroOriginSide === "LEFT"
            ? (schedule.headingReverse ? leftPx : rightPx)
            : (schedule.headingReverse ? rightPx : leftPx);

          const polygon = getVesselPolygon(xHead, xTail, topPy, bottomPy);
          drawVesselShape({
            ctx,
            polygon,
            schedule,
            isConflict,
            isSelected,
            bounds: { left: leftPx, right: rightPx, top: topPy, bottom: bottomPy },
          });

          newHitTargets.push({
            scheduleId: schedule.id,
            polygon,
            schedule,
            berthName: berth.name,
            isConflict,
          });
        }
      });
    } else {
      const toX = (t: Date) => LEFT_AXIS_W + timeToPixel(t, weekStart, weekEnd, drawW);
      const lanes = buildDatetimeBerthLanes(
        berths.map((berth) => ({
          id: berth.id,
          berthLength: berth.berthLength,
          zeroOriginSide: berth.zeroOriginSide,
        })),
        drawH,
      );
      const laneMap = new Map(lanes.map((lane) => [lane.id, lane]));

      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(LEFT_AXIS_W, 0, drawW, TOP_HEADER_H);
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, TOP_HEADER_H, LEFT_AXIS_W, drawH);

      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 0.5;
      for (const mark of hourMarks) {
        const x = toX(mark);
        if (x < LEFT_AXIS_W || x > canvasWidth) continue;
        ctx.beginPath();
        ctx.moveTo(x, TOP_HEADER_H);
        ctx.lineTo(x, TOP_HEADER_H + drawH);
        ctx.stroke();
      }

      ctx.strokeStyle = "#64748B";
      ctx.lineWidth = 1.25;
      for (const midnight of midnights) {
        const x = toX(midnight);
        if (x < LEFT_AXIS_W || x > canvasWidth) continue;
        ctx.beginPath();
        ctx.moveTo(x, TOP_HEADER_H);
        ctx.lineTo(x, TOP_HEADER_H + drawH);
        ctx.stroke();
      }

      ctx.textAlign = "center";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillStyle = "#64748B";
      ctx.textBaseline = "bottom";
      for (const mark of hourMarks) {
        const x = toX(mark);
        if (x < LEFT_AXIS_W || x > canvasWidth) continue;
        // Keep hour labels seated on their vertical grid line and above the top border.
        ctx.fillText(formatTime(mark, portTimezone), x, TOP_HEADER_H - 2);
      }

      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillStyle = "#1E293B";
      ctx.textBaseline = "bottom";
      for (const midnight of midnights) {
        const x = toX(midnight);
        if (x < LEFT_AXIS_W || x > canvasWidth) continue;
        const dateOnly = new Intl.DateTimeFormat("en-GB", {
          timeZone: portTimezone,
          day: "2-digit",
          month: "short",
        }).format(midnight);
        ctx.fillText(dateOnly, x, TOP_HEADER_H - 2);
      }

      if (lanes.length === 0) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
        ctx.fillRect(LEFT_AXIS_W, TOP_HEADER_H, drawW, drawH);
        ctx.fillStyle = "#64748B";
        ctx.font = "13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No active berths configured for this terminal.", LEFT_AXIS_W + drawW / 2, TOP_HEADER_H + drawH / 2);
      }

      for (const berth of berths) {
        const lane = laneMap.get(berth.id);
        if (!lane) continue;
        const laneTop = TOP_HEADER_H + lane.laneTop;
        const laneBottom = laneTop + lane.laneHeight;

        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(LEFT_AXIS_W, laneTop);
        ctx.lineTo(canvasWidth, laneTop);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(LEFT_AXIS_W, laneBottom);
        ctx.lineTo(canvasWidth, laneBottom);
        ctx.stroke();

        for (let m = 0; m <= berth.berthLength; m += 10) {
          const y = positionToDatetimeLaneY(
            m,
            berth.berthLength,
            berth.zeroOriginSide,
            laneTop,
            lane.laneHeight,
          );
          const isBold = m % 50 === 0;
          ctx.strokeStyle = isBold ? "#94A3B8" : "#E2E8F0";
          ctx.lineWidth = isBold ? 1 : 0.5;
          ctx.beginPath();
          ctx.moveTo(LEFT_AXIS_W, y);
          ctx.lineTo(canvasWidth, y);
          ctx.stroke();

          if (isBold) {
            ctx.fillStyle = "#334155";
            ctx.font = "bold 8px system-ui, sans-serif";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(`${m}m`, LEFT_AXIS_W - 4, y);
          }
        }

        ctx.fillStyle = "#1E293B";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.translate(14, laneTop + lane.laneHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(berth.name, 0, 0);
        ctx.restore();
      }

      const now = new Date();
      if (now > weekStart && now < weekEnd) {
        const nowX = toX(now);
        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(nowX, TOP_HEADER_H);
        ctx.lineTo(nowX, TOP_HEADER_H + drawH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#EF4444";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("Now", nowX + 3, TOP_HEADER_H + 3);
      }

      classifiedBerths.forEach(({ berth, valid }) => {
        const lane = laneMap.get(berth.id);
        if (!lane) return;
        const laneTop = TOP_HEADER_H + lane.laneTop;
        const laneHeight = lane.laneHeight;

        for (const schedule of valid) {
          const isConflict = conflictedIds.has(schedule.id);
          const isSelected = selectedSchedule?.id === schedule.id;

          const leftPx = toX(schedule.startTime);
          const rightPx = toX(schedule.endTime);
          const yA = positionToDatetimeLaneY(
            schedule.positionStart,
            berth.berthLength,
            berth.zeroOriginSide,
            laneTop,
            laneHeight,
          );
          const yB = positionToDatetimeLaneY(
            schedule.positionEnd,
            berth.berthLength,
            berth.zeroOriginSide,
            laneTop,
            laneHeight,
          );

          const topPy = Math.min(yA, yB);
          const bottomPy = Math.max(yA, yB);
          if (rightPx - leftPx < 1 || bottomPy - topPy < 1) continue;

          const originAtTop = berth.zeroOriginSide === "LEFT";
          const bowAtTop = schedule.headingReverse ? !originAtTop : originAtTop;
          const yHead = bowAtTop ? topPy : bottomPy;
          const yTail = bowAtTop ? bottomPy : topPy;
          const polygon = getVesselPolygonVertical(yHead, yTail, leftPx, rightPx);

          drawVesselShape({
            ctx,
            polygon,
            schedule,
            isConflict,
            isSelected,
            bounds: { left: leftPx, right: rightPx, top: topPy, bottom: bottomPy },
          });

          newHitTargets.push({
            scheduleId: schedule.id,
            polygon,
            schedule,
            berthName: berth.name,
            isConflict,
          });
        }
      });
    }

    hitTargetsRef.current = newHitTargets;
  }, [
    canvasWidth,
    canvasHeight,
    berths,
    weekStart,
    weekEnd,
    portTimezone,
    domain,
    selectedSchedule,
    conflictedIds,
    classifiedBerths,
  ]);

  const datetimeLanes = useMemo<DatetimeBerthLane[]>(() => {
    const drawH = canvasHeight - TOP_HEADER_H - BOTTOM_PAD;
    if (drawH <= 0) return [];
    return buildDatetimeBerthLanes(
      berths.map((berth) => ({
        id: berth.id,
        berthLength: berth.berthLength,
        zeroOriginSide: berth.zeroOriginSide,
      })),
      drawH,
    );
  }, [berths, canvasHeight]);

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
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        schedule: t.schedule,
        berthName: t.berthName,
        isConflict: t.isConflict,
      });
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
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const drawW = canvasWidth - LEFT_AXIS_W;
    const drawH = canvasHeight - TOP_HEADER_H - BOTTOM_PAD;

    const createDraft = convertCanvasClickToCreateSelectionByDomain({
      domain,
      x,
      y,
      frame: {
        leftAxisWidth: LEFT_AXIS_W,
        topHeaderHeight: TOP_HEADER_H,
        drawWidth: drawW,
        drawHeight: drawH,
      },
      berths: berths.map((berth) => ({
        id: berth.id,
        berthLength: berth.berthLength,
        zeroOriginSide: berth.zeroOriginSide,
      })),
      datetimeLanes,
      weekStart,
      weekEnd,
    });

    if (onGridCreateRequest && createDraft && shouldHandleCreateClick(false, createDraft)) {
      setSelectedSchedule(null);
      setSelectedBerthName("");
      setSelectedConflictPartners([]);
      onGridCreateRequest(createDraft);
      return;
    }

    if (isGridAreaClick(x, y, {
      leftAxisWidth: LEFT_AXIS_W,
      topHeaderHeight: TOP_HEADER_H,
      drawWidth: drawW,
      drawHeight: drawH,
    })) {
      setSelectedSchedule(null);
      setSelectedBerthName("");
      setSelectedConflictPartners([]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (e.key === "Escape") {
      setSelectedSchedule(null);
      setSelectedBerthName("");
      setSelectedConflictPartners([]);
    }
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
        onClose={() => {
          setSelectedSchedule(null);
          setSelectedBerthName("");
          setSelectedConflictPartners([]);
        }}
        onEdit={
          onEditRequest
            ? () => {
                if (!selectedSchedule) return;
                const scheduleId = selectedSchedule.id;
                setSelectedSchedule(null);
                setSelectedBerthName("");
                setSelectedConflictPartners([]);
                onEditRequest(scheduleId);
              }
            : undefined
        }
      />
    </div>
  );
}
