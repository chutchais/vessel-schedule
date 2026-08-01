import { snapTimeToMinutes, TIME_SNAP_MINUTES, type PlannerCanvasDomain, type PlannerCanvasFrame } from "./click-create";
import { hasPositionOverlap, hasTimeOverlap } from "./conflicts";
import { pixelToTime } from "./scales";
import type { ValidatedSchedule } from "./types";

export const RESIZE_EDGE_HIT_PX = 8;
export const MIN_RESIZE_DURATION_MS = TIME_SNAP_MINUTES * 60 * 1000;

export type ResizeEdge = "start" | "end";

export type ResizeInvalidReason = "etb_before_eta" | "too_short" | "out_of_week" | "start_at_or_after_etd";

export type ResizeProposal = {
  edge: ResizeEdge;
  newStartTime: Date;
  newEndTime: Date;
  durationMs: number;
  isValid: boolean;
  invalidReason?: ResizeInvalidReason;
  hasConflict: boolean;
};

export function isResizeVersionCurrent(currentUpdatedAt: Date, expectedUpdatedAt: unknown) {
  return (
    typeof expectedUpdatedAt === "string" &&
    expectedUpdatedAt.length > 0 &&
    currentUpdatedAt.toISOString() === expectedUpdatedAt
  );
}

export function getResizeEdgeAtPoint(input: {
  x: number;
  y: number;
  bounds: { left: number; right: number; top: number; bottom: number };
  domain: PlannerCanvasDomain;
  hitAreaPx?: number;
}): ResizeEdge | null {
  const { x, y, bounds, domain, hitAreaPx = RESIZE_EDGE_HIT_PX } = input;
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;

  const startDistance = domain === "position" ? Math.abs(y - bounds.top) : Math.abs(x - bounds.left);
  const endDistance = domain === "position" ? Math.abs(y - bounds.bottom) : Math.abs(x - bounds.right);
  const closest = Math.min(startDistance, endDistance);
  if (closest > hitAreaPx) return null;
  return startDistance <= endDistance ? "start" : "end";
}

export function computeResizeProposal(input: {
  schedule: ValidatedSchedule;
  edge: ResizeEdge;
  pointerX: number;
  pointerY: number;
  domain: PlannerCanvasDomain;
  frame: PlannerCanvasFrame;
  weekStart: Date;
  weekEnd: Date;
  otherSchedules: ValidatedSchedule[];
}): ResizeProposal {
  const { schedule, edge, pointerX, pointerY, domain, frame, weekStart, weekEnd, otherSchedules } = input;
  const timePixel =
    domain === "position"
      ? pointerY - frame.topHeaderHeight
      : pointerX - frame.leftAxisWidth;
  const timeSize = domain === "position" ? frame.drawHeight : frame.drawWidth;
  const snapped = snapTimeToMinutes(
    pixelToTime(timePixel, weekStart, weekEnd, timeSize),
    TIME_SNAP_MINUTES,
  );

  const newStartTime = edge === "start" ? snapped : schedule.startTime;
  const newEndTime = edge === "end" ? snapped : schedule.endTime;
  const durationMs = newEndTime.getTime() - newStartTime.getTime();

  // When start-edge resizing a schedule that has ETB, the new start becomes the new ETB.
  // ETB must not be before ETA (invariant: ETA <= ETB < ETD).
  const etbBeforeEta =
    edge === "start" &&
    schedule.etb !== null &&
    newStartTime < schedule.eta;

  let invalidReason: ResizeInvalidReason | undefined;
  if (etbBeforeEta) {
    invalidReason = "etb_before_eta";
  } else if (durationMs < MIN_RESIZE_DURATION_MS) {
    invalidReason = "too_short";
  } else if (newStartTime >= weekEnd || newEndTime <= weekStart) {
    invalidReason = "out_of_week";
  }

  const isValid =
    !invalidReason &&
    durationMs >= MIN_RESIZE_DURATION_MS &&
    newStartTime < weekEnd &&
    newEndTime > weekStart;

  const hasConflict = isValid && otherSchedules.some((other) => {
    if (other.berthId !== schedule.berthId || other.status === "CANCELLED") return false;
    return (
      hasTimeOverlap(newStartTime, newEndTime, other.startTime, other.endTime) &&
      hasPositionOverlap(
        schedule.positionStart,
        schedule.positionEnd,
        other.positionStart,
        other.positionEnd,
      )
    );
  });

  return { edge, newStartTime, newEndTime, durationMs, isValid, invalidReason, hasConflict };
}

export function applyResizeTimes(input: {
  eta: string;
  etb: string | null;
  etd: string;
  edge: ResizeEdge;
  newStartTime: Date;
  newEndTime: Date;
}) {
  const { eta, etb, etd, edge, newStartTime, newEndTime } = input;
  return {
    eta: edge === "start" && !etb ? newStartTime.toISOString() : eta,
    etb: edge === "start" && etb ? newStartTime.toISOString() : etb,
    etd: edge === "end" ? newEndTime.toISOString() : etd,
  };
}
