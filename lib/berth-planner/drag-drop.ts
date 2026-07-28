import {
  buildBerthOffsets,
  snapMeters,
  snapTimeToMinutes,
  TIME_SNAP_MINUTES,
  POSITION_SNAP_METERS,
  type ClickCreateBerth,
  type PlannerCanvasFrame,
  type PlannerCanvasDomain,
} from "./click-create";
import { pixelToTime } from "./scales";
import { datetimeLaneYToPosition, type DatetimeBerthLane } from "./datetime-domain";
import { hasTimeOverlap, hasPositionOverlap } from "./conflicts";
import type { ValidatedSchedule } from "./types";

export { TIME_SNAP_MINUTES, POSITION_SNAP_METERS };
export type { ClickCreateBerth, PlannerCanvasFrame, PlannerCanvasDomain };

export const DRAG_THRESHOLD_PX = 5;

export type DragBerth = ClickCreateBerth & { name: string };

export type DragGrab = {
  scheduleId: string;
  vesselName: string;
  berthId: string;
  berthName: string;
  originalStartTime: Date;
  originalEndTime: Date;
  originalPositionStart: number;
  durationMs: number;
  vesselLoa: number;
  startPointerX: number;
  startPointerY: number;
  /** domain time at grab point minus originalStartTime, in ms */
  grabTimeOffsetMs: number;
  /** domain position at grab point minus originalPositionStart, in metres */
  grabPositionOffsetMeters: number;
};

export type DragProposal = {
  berthId: string;
  berthName: string;
  newPositionStart: number;
  newPositionEnd: number;
  newStartTime: Date;
  newEndTime: Date;
  /** fits in berth AND time within visible range */
  isValid: boolean;
  hasConflict: boolean;
};

export function isDragThresholdExceeded(
  startX: number,
  startY: number,
  x: number,
  y: number,
): boolean {
  const dx = x - startX;
  const dy = y - startY;
  return Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX;
}

function findBerthAtRelX(
  relX: number,
  drawWidth: number,
  berths: DragBerth[],
): { berth: DragBerth; localMeters: number } | null {
  const totalLength = berths.reduce((s, b) => s + b.berthLength, 0);
  if (totalLength <= 0 || drawWidth <= 0) return null;
  if (relX < 0 || relX > drawWidth) return null;

  const globalMeters = (relX / drawWidth) * totalLength;
  const offsets = buildBerthOffsets(berths);

  for (let i = 0; i < berths.length; i++) {
    const berth = berths[i]!;
    const start = offsets[i]!;
    const end = start + berth.berthLength;
    const isLast = i === berths.length - 1;
    const inRange = globalMeters >= start && (globalMeters < end || (isLast && globalMeters <= end));
    if (!inRange) continue;

    const metresFromLeft = globalMeters - start;
    const localMeters =
      berth.zeroOriginSide === "RIGHT"
        ? berth.berthLength - metresFromLeft
        : metresFromLeft;
    return { berth, localMeters };
  }
  return null;
}

function findDatetimeLaneAtY(y: number, lanes: DatetimeBerthLane[]): DatetimeBerthLane | null {
  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i]!;
    const laneBottom = lane.laneTop + lane.laneHeight;
    const isLast = i === lanes.length - 1;
    const inRange = y >= lane.laneTop && (y < laneBottom || (isLast && y <= laneBottom));
    if (inRange) return lane;
  }
  return null;
}

export function computeDragGrab(input: {
  schedule: ValidatedSchedule;
  berthId: string;
  berthName: string;
  pointerX: number;
  pointerY: number;
  domain: PlannerCanvasDomain;
  frame: PlannerCanvasFrame;
  berths: DragBerth[];
  datetimeLanes: DatetimeBerthLane[];
  weekStart: Date;
  weekEnd: Date;
}): DragGrab {
  const {
    schedule,
    berthId,
    berthName,
    pointerX,
    pointerY,
    domain,
    frame,
    berths,
    datetimeLanes,
    weekStart,
    weekEnd,
  } = input;

  const relX = pointerX - frame.leftAxisWidth;
  const relY = pointerY - frame.topHeaderHeight;

  let grabTimeOffsetMs: number;
  let grabPositionOffsetMeters: number;

  if (domain === "position") {
    const grabTime = pixelToTime(relY, weekStart, weekEnd, frame.drawHeight);
    grabTimeOffsetMs = grabTime.getTime() - schedule.startTime.getTime();

    const hit = findBerthAtRelX(relX, frame.drawWidth, berths);
    const grabLocalMeters = hit?.localMeters ?? schedule.positionStart;
    grabPositionOffsetMeters = grabLocalMeters - schedule.positionStart;
  } else {
    const grabTime = pixelToTime(relX, weekStart, weekEnd, frame.drawWidth);
    grabTimeOffsetMs = grabTime.getTime() - schedule.startTime.getTime();

    const lane = findDatetimeLaneAtY(relY, datetimeLanes);
    let grabLocalMeters = schedule.positionStart;
    if (lane) {
      grabLocalMeters = datetimeLaneYToPosition(
        relY,
        lane.berthLength,
        lane.zeroOriginSide,
        lane.laneTop,
        lane.laneHeight,
      );
    }
    grabPositionOffsetMeters = grabLocalMeters - schedule.positionStart;
  }

  return {
    scheduleId: schedule.id,
    vesselName: schedule.vesselName,
    berthId,
    berthName,
    originalStartTime: schedule.startTime,
    originalEndTime: schedule.endTime,
    originalPositionStart: schedule.positionStart,
    durationMs: schedule.endTime.getTime() - schedule.startTime.getTime(),
    vesselLoa: schedule.positionEnd - schedule.positionStart,
    startPointerX: pointerX,
    startPointerY: pointerY,
    grabTimeOffsetMs,
    grabPositionOffsetMeters,
  };
}

export function computeDragProposal(input: {
  grab: DragGrab;
  pointerX: number;
  pointerY: number;
  domain: PlannerCanvasDomain;
  frame: PlannerCanvasFrame;
  berths: DragBerth[];
  datetimeLanes: DatetimeBerthLane[];
  weekStart: Date;
  weekEnd: Date;
  otherSchedules: ValidatedSchedule[];
}): DragProposal | null {
  const {
    grab,
    pointerX,
    pointerY,
    domain,
    frame,
    berths,
    datetimeLanes,
    weekStart,
    weekEnd,
    otherSchedules,
  } = input;

  const relX = pointerX - frame.leftAxisWidth;
  const relY = pointerY - frame.topHeaderHeight;

  let newStartTime: Date;
  let newEndTime: Date;
  let targetBerth: DragBerth | null = null;
  let newPositionStart: number;
  let newPositionEnd: number;

  if (domain === "position") {
    if (relX < 0 || relX > frame.drawWidth) return null;

    const ptrTime = pixelToTime(relY, weekStart, weekEnd, frame.drawHeight);
    const rawStart = new Date(ptrTime.getTime() - grab.grabTimeOffsetMs);
    newStartTime = snapTimeToMinutes(rawStart, TIME_SNAP_MINUTES);
    newEndTime = new Date(newStartTime.getTime() + grab.durationMs);

    const hit = findBerthAtRelX(relX, frame.drawWidth, berths);
    if (!hit) return null;

    targetBerth = hit.berth;
    const rawPosition = hit.localMeters - grab.grabPositionOffsetMeters;
    newPositionStart = Math.max(0, snapMeters(rawPosition, POSITION_SNAP_METERS));
    newPositionEnd = newPositionStart + grab.vesselLoa;
  } else {
    if (relX < 0 || relX > frame.drawWidth) return null;

    const lane = findDatetimeLaneAtY(relY, datetimeLanes);
    if (!lane) return null;

    const ptrTime = pixelToTime(relX, weekStart, weekEnd, frame.drawWidth);
    const rawStart = new Date(ptrTime.getTime() - grab.grabTimeOffsetMs);
    newStartTime = snapTimeToMinutes(rawStart, TIME_SNAP_MINUTES);
    newEndTime = new Date(newStartTime.getTime() + grab.durationMs);

    const localMeter = datetimeLaneYToPosition(
      relY,
      lane.berthLength,
      lane.zeroOriginSide,
      lane.laneTop,
      lane.laneHeight,
    );
    const rawPosition = localMeter - grab.grabPositionOffsetMeters;
    newPositionStart = Math.max(0, snapMeters(rawPosition, POSITION_SNAP_METERS));
    newPositionEnd = newPositionStart + grab.vesselLoa;

    targetBerth = berths.find((b) => b.id === lane.id) ?? null;
    if (!targetBerth) return null;
  }

  const fitsInBerth = newPositionEnd <= targetBerth.berthLength;
  const withinRange = newStartTime < weekEnd && newEndTime > weekStart;
  const isValid = fitsInBerth && withinRange;

  const tbId = targetBerth.id;
  const hasConflict = otherSchedules.some((s) => {
    if (s.berthId !== tbId) return false;
    if (s.status === "CANCELLED") return false;
    return (
      hasTimeOverlap(newStartTime, newEndTime, s.startTime, s.endTime) &&
      hasPositionOverlap(newPositionStart, newPositionEnd, s.positionStart, s.positionEnd)
    );
  });

  return {
    berthId: targetBerth.id,
    berthName: targetBerth.name,
    newPositionStart,
    newPositionEnd,
    newStartTime,
    newEndTime,
    isValid,
    hasConflict,
  };
}
