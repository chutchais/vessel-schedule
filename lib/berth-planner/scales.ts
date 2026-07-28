import type { ZeroOriginSide } from "./types";

/**
 * Convert a UTC time to a Y pixel coordinate within the canvas drawing area.
 *
 * @param time      The instant to convert.
 * @param rangeStart Start of the visible time range.
 * @param rangeEnd   End of the visible time range.
 * @param drawHeight Height of the canvas drawing area (excluding any header margin).
 * @returns Y pixel value; may be negative or > drawHeight when outside the visible range.
 */
export function timeToPixel(
  time: Date,
  rangeStart: Date,
  rangeEnd: Date,
  drawHeight: number,
): number {
  const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
  if (rangeMs <= 0) return 0;
  const offsetMs = time.getTime() - rangeStart.getTime();
  return (offsetMs / rangeMs) * drawHeight;
}

/**
 * Convert a Y pixel coordinate back to a UTC Date.
 */
export function pixelToTime(
  pixel: number,
  rangeStart: Date,
  rangeEnd: Date,
  drawHeight: number,
): Date {
  const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
  if (drawHeight <= 0) return new Date(rangeStart);
  const offsetMs = (pixel / drawHeight) * rangeMs;
  return new Date(rangeStart.getTime() + offsetMs);
}

/**
 * Convert a berth position in metres to an X pixel coordinate within the berth row.
 *
 * @param meters         Position along the berth in metres.
 * @param berthLength    Total berth length in metres.
 * @param drawWidth      Width of the berth drawing area in pixels.
 * @param zeroOriginSide Which edge of the berth is metre-zero.
 * @returns X pixel value relative to the left edge of the berth drawing area.
 */
export function positionToPixel(
  meters: number,
  berthLength: number,
  drawWidth: number,
  zeroOriginSide: ZeroOriginSide,
): number {
  if (berthLength <= 0) return 0;
  const fraction = meters / berthLength;
  if (zeroOriginSide === "RIGHT") {
    // Metre-zero is on the right; metre-max is on the left.
    return (1 - fraction) * drawWidth;
  }
  // Metre-zero is on the left (default).
  return fraction * drawWidth;
}

/**
 * Convert an X pixel coordinate back to a berth position in metres.
 */
export function pixelToPosition(
  pixel: number,
  berthLength: number,
  drawWidth: number,
  zeroOriginSide: ZeroOriginSide,
): number {
  if (drawWidth <= 0) return 0;
  const fraction = pixel / drawWidth;
  if (zeroOriginSide === "RIGHT") {
    return (1 - fraction) * berthLength;
  }
  return fraction * berthLength;
}

/**
 * Return a sensible metre-tick interval (in metres) so that ticks are readable
 * at the current drawWidth.
 */
export function getMeterTickInterval(berthLength: number, drawWidth: number): number {
  if (drawWidth <= 0 || berthLength <= 0) return 50;
  const candidates = [5, 10, 20, 25, 50, 100, 200, 250, 500];
  const minPixelsBetweenTicks = 40;
  for (const interval of candidates) {
    const pixelsPerTick = (interval / berthLength) * drawWidth;
    if (pixelsPerTick >= minPixelsBetweenTicks) {
      return interval;
    }
  }
  return candidates[candidates.length - 1]!;
}
