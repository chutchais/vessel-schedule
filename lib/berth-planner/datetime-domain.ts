import type { ZeroOriginSide } from "./types";

export type DatetimeLaneBerth = {
  id: string;
  berthLength: number;
  zeroOriginSide: ZeroOriginSide;
};

export type DatetimeBerthLane = DatetimeLaneBerth & {
  laneTop: number;
  laneHeight: number;
};

export function buildDatetimeBerthLanes(
  berths: DatetimeLaneBerth[],
  drawHeight: number,
): DatetimeBerthLane[] {
  if (berths.length === 0 || drawHeight <= 0) return [];

  const laneGap = berths.length > 1 ? 8 : 0;
  const totalGap = laneGap * (berths.length - 1);
  const laneHeight = Math.max(1, (drawHeight - totalGap) / berths.length);

  let laneTop = 0;
  return berths.map((berth) => {
    const lane: DatetimeBerthLane = {
      ...berth,
      laneTop,
      laneHeight,
    };
    laneTop += laneHeight + laneGap;
    return lane;
  });
}

export function positionToDatetimeLaneY(
  meters: number,
  berthLength: number,
  zeroOriginSide: ZeroOriginSide,
  laneTop: number,
  laneHeight: number,
): number {
  if (berthLength <= 0 || laneHeight <= 0) return laneTop;
  const fraction = Math.min(1, Math.max(0, meters / berthLength));
  if (zeroOriginSide === "RIGHT") {
    return laneTop + (1 - fraction) * laneHeight;
  }
  return laneTop + fraction * laneHeight;
}

export function datetimeLaneYToPosition(
  y: number,
  berthLength: number,
  zeroOriginSide: ZeroOriginSide,
  laneTop: number,
  laneHeight: number,
): number {
  if (laneHeight <= 0 || berthLength <= 0) return 0;
  const fraction = Math.min(1, Math.max(0, (y - laneTop) / laneHeight));
  if (zeroOriginSide === "RIGHT") {
    return (1 - fraction) * berthLength;
  }
  return fraction * berthLength;
}
