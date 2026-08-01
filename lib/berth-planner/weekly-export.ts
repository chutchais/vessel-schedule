import { detectConflicts } from "./conflicts";
import { getVesselPolygon, getVesselPolygonVertical } from "./geometry";
import { classifySchedules } from "./layout";
import { timeToPixel } from "./scales";
import { formatDate, formatTime, formatTimezoneOffset, formatWeekLabel, get4HourMarks, getMidnightsBetween } from "./timezone";
import { blendRgb, drawVesselLabelLines, type VesselLabelConfig } from "./vessel-label";
import type { PlannerBerth, PlannerDomain, ValidatedSchedule } from "./types";

export type WeeklyExportPage = { berthIds: string[]; page: number; totalPages: number };

/** Splits only at berth boundaries, so every page retains meaningful metre context. */
export function buildWeeklyExportPages(berths: PlannerBerth[], domain: PlannerDomain): WeeklyExportPage[] {
  const limit = domain === "position" ? 1_200 : 6;
  const groups: PlannerBerth[][] = [];
  let current: PlannerBerth[] = [];
  let metres = 0;
  for (const berth of berths) {
    const exceeds = domain === "position" ? metres + berth.berthLength > limit : current.length >= limit;
    if (current.length && exceeds) { groups.push(current); current = []; metres = 0; }
    current.push(berth); metres += berth.berthLength;
  }
  if (current.length || !groups.length) groups.push(current);
  return groups.map((group, index, all) => ({ berthIds: group.map((berth) => berth.id), page: index + 1, totalPages: all.length }));
}

export type WeeklyExportInput = {
  organizationName: string;
  portName: string;
  terminalName: string;
  timezone: string;
  weekStart: Date;
  weekEnd: Date;
  domain: PlannerDomain;
  filtersSummary: string;
  berths: PlannerBerth[];
  vesselLabelConfig: VesselLabelConfig;
  generatedAt?: Date;
};

function path(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath(); ctx.moveTo(...points[0]!);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]!);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)]
    : [59, 130, 246];
}

function validByBerth(berths: PlannerBerth[]) {
  return berths.map((berth) => ({ berth, valid: classifySchedules(berth.schedules, berth.berthLength).valid }));
}

/** Creates high-resolution, self-contained canvases. No application UI is copied into output. */
export function renderWeeklyExport(input: WeeklyExportInput): HTMLCanvasElement[] {
  const pages = buildWeeklyExportPages(input.berths, input.domain);
  const allValid = validByBerth(input.berths);
  const conflicts = new Set<string>();
  for (const { valid } of allValid) for (const id of detectConflicts(valid).conflictedIds) conflicts.add(id);
  const midnights = getMidnightsBetween(input.weekStart, input.weekEnd, input.timezone);
  const marks = get4HourMarks(input.weekStart, input.weekEnd, input.timezone);
  const generatedAt = input.generatedAt ?? new Date();

  return pages.map((page) => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400; canvas.height = 1500;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height, left = 130, top = 230, right = 70, bottom = 130;
    const gw = W - left - right, gh = H - top - bottom;
    const pageBerths = allValid.filter(({ berth }) => page.berthIds.includes(berth.id));
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0f172a"; ctx.font = "bold 38px system-ui"; ctx.fillText("Weekly Berth Planner", 70, 65);
    ctx.font = "24px system-ui";
    ctx.fillText(`${input.organizationName} · ${input.portName} · ${input.terminalName}`, 70, 108);
    ctx.fillText(`${formatWeekLabel(input.weekStart, input.weekEnd, input.timezone)} · ${input.timezone} (${formatTimezoneOffset(input.weekStart, input.timezone)}) · ${input.domain === "position" ? "Position view" : "Datetime view"}`, 70, 145);
    ctx.font = "20px system-ui"; ctx.fillStyle = "#475569";
    ctx.fillText(`Filters: ${input.filtersSummary || "None"}`, 70, 180);
    ctx.fillText(`Page ${page.page} of ${page.totalPages} · Generated ${new Intl.DateTimeFormat("en-GB", { timeZone: input.timezone, dateStyle: "medium", timeStyle: "short" }).format(generatedAt)}`, 70, H - 45);
    ctx.fillStyle = "#fff"; ctx.fillRect(left, top, gw, gh); ctx.strokeStyle = "#334155"; ctx.strokeRect(left, top, gw, gh);

    const drawVessel = (
      schedule: ValidatedSchedule,
      points: [number, number][],
      berthInfo: { name: string; berthLength: number; zeroOriginSide: "LEFT" | "RIGHT" },
    ) => {
      path(ctx, points); const conflict = conflicts.has(schedule.id);
      ctx.fillStyle = schedule.status === "CANCELLED" ? "#e2e8f0" : conflict ? "#fecaca" : `${schedule.serviceColor ?? schedule.vesselColor}66`;
      ctx.strokeStyle = conflict ? "#991b1b" : "#1e3a8a"; ctx.lineWidth = conflict ? 5 : 2; ctx.fill(); ctx.stroke();
      const xs = points.map(([x]) => x), ys = points.map(([, y]) => y); const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      if (Math.max(...xs) - Math.min(...xs) > 90 && Math.max(...ys) - Math.min(...ys) > 24) {
        const bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
        if (conflict && schedule.status !== "CANCELLED") {
          ctx.fillStyle = "#991b1b";
          ctx.font = "bold 14px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("⚠", x, bounds.top + 3);
        }
        drawVesselLabelLines({
          ctx,
          polygon: points,
          bounds,
          config: input.vesselLabelConfig,
          context: {
            vesselName: schedule.vesselName,
            serviceName: schedule.serviceName,
            serviceColor: schedule.serviceColor,
            voyageNumber: schedule.voyageNumber,
            berthName: berthInfo.name,
            berthLength: berthInfo.berthLength,
            berthZeroOriginSide: berthInfo.zeroOriginSide,
            scheduleStatus: schedule.status,
            berthPositionStart: schedule.positionStart,
            berthPositionEnd: schedule.positionEnd,
            headingReverse: schedule.headingReverse,
            remarks: schedule.remarks,
            eta: schedule.startTime,
            etb: schedule.etb,
            etd: schedule.endTime,
            vesselLoa: schedule.vesselLoa,
            updatedAt: schedule.updatedAt,
            timezone: input.timezone,
          },
          backgroundRgb: schedule.status === "CANCELLED"
            ? [226, 232, 240]
            : conflict
              ? [254, 202, 202]
              : blendRgb(hexToRgb(schedule.serviceColor ?? schedule.vesselColor), 0.4),
          labelScalePercent: 100,
          minFontSize: 12,
          maxFontSize: 18,
          smallFontSize: 13,
          normalFontSize: 16,
          bigFontSize: 17,
          biggerFontSize: 18,
          lineGap: 2,
          horizontalPadding: 6,
          verticalPadding: 3,
          topInset: conflict && schedule.status !== "CANCELLED" ? 16 : 0,
        });
      }
    };

    if (input.domain === "position") {
      const total = pageBerths.reduce((sum, item) => sum + item.berth.berthLength, 0) || 1;
      const x = (metres: number) => left + metres / total * gw;
      const y = (date: Date) => top + timeToPixel(date, input.weekStart, input.weekEnd, gh);
      for (const mark of marks) { const yy = y(mark); const midnight = midnights.some((d) => d.getTime() === mark.getTime()); ctx.strokeStyle = midnight ? "#475569" : "#cbd5e1"; ctx.lineWidth = midnight ? 3 : 1; ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(left + gw, yy); ctx.stroke(); }
      let offset = 0;
      for (const { berth, valid } of pageBerths) {
        const a = x(offset), b = x(offset + berth.berthLength); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a, top); ctx.lineTo(a, top + gh); ctx.stroke();
        ctx.fillStyle = "#0f172a"; ctx.font = "bold 20px system-ui"; ctx.textAlign = "center"; ctx.fillText(`${berth.name} (${berth.berthLength}m)`, (a + b) / 2, top - 14, b - a - 8);
        for (let m = 50; m < berth.berthLength; m += 50) { const xx = x(offset + m); ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, top + gh); ctx.stroke(); }
        for (const schedule of valid) { const l = berth.zeroOriginSide === "LEFT" ? x(offset + schedule.positionStart) : x(offset + berth.berthLength - schedule.positionEnd); const r = berth.zeroOriginSide === "LEFT" ? x(offset + schedule.positionEnd) : x(offset + berth.berthLength - schedule.positionStart); drawVessel(schedule, getVesselPolygon(schedule.headingReverse ? r : l, schedule.headingReverse ? l : r, y(schedule.startTime), y(schedule.endTime)), { name: berth.name, berthLength: berth.berthLength, zeroOriginSide: berth.zeroOriginSide }); }
        offset += berth.berthLength;
      }
      ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(left + gw, top); ctx.lineTo(left + gw, top + gh); ctx.stroke();
      ctx.textAlign = "right"; for (const midnight of midnights) { ctx.fillStyle = "#0f172a"; ctx.font = "bold 17px system-ui"; ctx.fillText(formatDate(midnight, input.timezone), left - 10, y(midnight) + 5); }
      ctx.fillStyle = "#475569"; ctx.font = "14px system-ui"; for (const mark of marks) if (!midnights.some((d) => d.getTime() === mark.getTime())) ctx.fillText(formatTime(mark, input.timezone), left - 10, y(mark) + 4);
    } else {
      const x = (date: Date) => left + timeToPixel(date, input.weekStart, input.weekEnd, gw);
      const lane = gh / Math.max(pageBerths.length, 1);
      for (const mark of marks) { const xx = x(mark); const midnight = midnights.some((d) => d.getTime() === mark.getTime()); ctx.strokeStyle = midnight ? "#475569" : "#cbd5e1"; ctx.lineWidth = midnight ? 3 : 1; ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, top + gh); ctx.stroke(); }
      pageBerths.forEach(({ berth, valid }, i) => { const a = top + i * lane; ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; ctx.strokeRect(left, a, gw, lane); ctx.fillStyle = "#0f172a"; ctx.font = "bold 18px system-ui"; ctx.textAlign = "left"; ctx.fillText(`${berth.name} (${berth.berthLength}m)`, 8, a + 26); for (let m = 50; m < berth.berthLength; m += 50) { const yy = a + lane - m / berth.berthLength * lane; ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(left + gw, yy); ctx.stroke(); } for (const schedule of valid) { const y1 = a + lane - schedule.positionStart / berth.berthLength * lane, y2 = a + lane - schedule.positionEnd / berth.berthLength * lane; const high = Math.min(y1, y2), low = Math.max(y1, y2); drawVessel(schedule, getVesselPolygonVertical(schedule.headingReverse ? high : low, schedule.headingReverse ? low : high, x(schedule.startTime), x(schedule.endTime)), { name: berth.name, berthLength: berth.berthLength, zeroOriginSide: berth.zeroOriginSide }); } });
      ctx.textAlign = "center"; ctx.fillStyle = "#0f172a"; ctx.font = "bold 17px system-ui"; for (const midnight of midnights) ctx.fillText(formatDate(midnight, input.timezone), x(midnight), top - 14);
      ctx.fillStyle = "#475569"; ctx.font = "14px system-ui"; for (const mark of marks) if (!midnights.some((d) => d.getTime() === mark.getTime())) ctx.fillText(formatTime(mark, input.timezone), x(mark), top - 34);
    }
    ctx.textAlign = "left"; ctx.fillStyle = "#334155"; ctx.font = "18px system-ui"; ctx.fillText("Legend: vessel = scheduled call; red outline / ⚠ = berth-time-position conflict; dark lines = berth boundaries and daily grid; 50m grid lines shown per berth.", 70, H - 82);
    return canvas;
  });
}
