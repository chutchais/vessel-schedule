import { pixelToTime } from "./scales";
import { datetimeLaneYToPosition, type DatetimeBerthLane } from "./datetime-domain";
import type { ZeroOriginSide } from "./types";

export const TIME_SNAP_MINUTES = 30;
export const POSITION_SNAP_METERS = 5;

export type ClickCreateBerth = {
  id: string;
  berthLength: number;
  zeroOriginSide: ZeroOriginSide;
};

export type PlannerCanvasFrame = {
  leftAxisWidth: number;
  topHeaderHeight: number;
  drawWidth: number;
  drawHeight: number;
};

export type ClickCreateSelection = {
  berthId: string;
  berthPositionMeters: number;
  plannedStartTime: Date;
};

export type PlannerCanvasDomain = "position" | "datetime";

export function shouldHandleCreateClick(
  hasScheduleHit: boolean,
  selection: ClickCreateSelection | null,
): boolean {
  return !hasScheduleHit && selection !== null;
}

export function snapMeters(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function snapTimeToMinutes(date: Date, minutes: number): Date {
  if (minutes <= 0) return new Date(date);
  const stepMs = minutes * 60_000;
  return new Date(Math.round(date.getTime() / stepMs) * stepMs);
}

export function isGridAreaClick(
  x: number,
  y: number,
  frame: PlannerCanvasFrame,
): boolean {
  return (
    x >= frame.leftAxisWidth &&
    x <= frame.leftAxisWidth + frame.drawWidth &&
    y >= frame.topHeaderHeight &&
    y <= frame.topHeaderHeight + frame.drawHeight
  );
}

export function buildBerthOffsets(berths: ClickCreateBerth[]): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (const berth of berths) {
    offsets.push(acc);
    acc += berth.berthLength;
  }
  return offsets;
}

function globalMetersFromCanvasX(
  x: number,
  frame: PlannerCanvasFrame,
  totalLength: number,
): number | null {
  if (totalLength <= 0 || frame.drawWidth <= 0) return null;
  const relativeX = x - frame.leftAxisWidth;
  if (relativeX < 0 || relativeX > frame.drawWidth) return null;
  return (relativeX / frame.drawWidth) * totalLength;
}

function findBerthAtGlobalMeters(
  globalMeters: number,
  berths: ClickCreateBerth[],
  offsets: number[],
): { berth: ClickCreateBerth; localMeters: number } | null {
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

export function convertCanvasClickToCreateSelection(input: {
  x: number;
  y: number;
  frame: PlannerCanvasFrame;
  berths: ClickCreateBerth[];
  weekStart: Date;
  weekEnd: Date;
}): ClickCreateSelection | null {
  const { x, y, frame, berths, weekStart, weekEnd } = input;
  if (!isGridAreaClick(x, y, frame)) return null;
  if (berths.length === 0) return null;

  const totalLength = berths.reduce((sum, b) => sum + b.berthLength, 0);
  const globalMeters = globalMetersFromCanvasX(x, frame, totalLength);
  if (globalMeters === null) return null;

  const offsets = buildBerthOffsets(berths);
  const mapped = findBerthAtGlobalMeters(globalMeters, berths, offsets);
  if (!mapped) return null;

  if (mapped.localMeters < 0 || mapped.localMeters > mapped.berth.berthLength) {
    return null;
  }

  const snappedPosition = snapMeters(mapped.localMeters, POSITION_SNAP_METERS);
  const berthPositionMeters = Math.min(
    mapped.berth.berthLength,
    Math.max(0, snappedPosition),
  );

  const timeInRange = pixelToTime(
    y - frame.topHeaderHeight,
    weekStart,
    weekEnd,
    frame.drawHeight,
  );
  const plannedStartTime = snapTimeToMinutes(timeInRange, TIME_SNAP_MINUTES);

  return {
    berthId: mapped.berth.id,
    berthPositionMeters,
    plannedStartTime,
  };
}

function findDatetimeLaneAtY(
  y: number,
  lanes: DatetimeBerthLane[],
): DatetimeBerthLane | null {
  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i]!;
    const laneBottom = lane.laneTop + lane.laneHeight;
    const isLast = i === lanes.length - 1;
    const inRange = y >= lane.laneTop && (y < laneBottom || (isLast && y <= laneBottom));
    if (inRange) return lane;
  }
  return null;
}

export function convertCanvasClickToCreateSelectionByDomain(input: {
  domain: PlannerCanvasDomain;
  x: number;
  y: number;
  frame: PlannerCanvasFrame;
  berths: ClickCreateBerth[];
  datetimeLanes?: DatetimeBerthLane[];
  weekStart: Date;
  weekEnd: Date;
}): ClickCreateSelection | null {
  if (input.domain === "position") {
    return convertCanvasClickToCreateSelection(input);
  }

  const { x, y, frame, weekStart, weekEnd } = input;
  if (!isGridAreaClick(x, y, frame)) return null;
  if (!input.datetimeLanes || input.datetimeLanes.length === 0) return null;

  const lane = findDatetimeLaneAtY(y - frame.topHeaderHeight, input.datetimeLanes);
  if (!lane) return null;

  const timeInRange = pixelToTime(
    x - frame.leftAxisWidth,
    weekStart,
    weekEnd,
    frame.drawWidth,
  );
  const plannedStartTime = snapTimeToMinutes(timeInRange, TIME_SNAP_MINUTES);

  const localMeters = datetimeLaneYToPosition(
    y - frame.topHeaderHeight,
    lane.berthLength,
    lane.zeroOriginSide,
    lane.laneTop,
    lane.laneHeight,
  );

  const snappedPosition = snapMeters(localMeters, POSITION_SNAP_METERS);
  const berthPositionMeters = Math.min(
    lane.berthLength,
    Math.max(0, snappedPosition),
  );

  return {
    berthId: lane.id,
    berthPositionMeters,
    plannedStartTime,
  };
}
