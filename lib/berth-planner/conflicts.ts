import type { ValidatedSchedule, ConflictPair } from "./types";

/**
 * Test whether two time intervals overlap using strict inequality.
 * Intervals that only touch at an endpoint are NOT considered overlapping.
 */
export function hasTimeOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Test whether two position intervals (in metres) overlap using strict inequality.
 * Intervals that only touch at an endpoint are NOT considered overlapping.
 */
export function hasPositionOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Detect all conflicting schedule pairs within a single berth.
 *
 * A conflict exists when two non-cancelled schedules on the same berth overlap
 * in BOTH time and position simultaneously.
 *
 * @returns A Set of schedule IDs that are involved in at least one conflict,
 *          and an array of ConflictPair describing each pair.
 */
export function detectConflicts(schedules: ValidatedSchedule[]): {
  conflictedIds: Set<string>;
  pairs: ConflictPair[];
} {
  const active = schedules.filter((s) => s.status !== "CANCELLED");
  const pairs: ConflictPair[] = [];
  const conflictedIds = new Set<string>();

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;

      const timeConflict = hasTimeOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
      const posConflict = hasPositionOverlap(
        a.positionStart,
        a.positionEnd,
        b.positionStart,
        b.positionEnd,
      );

      if (timeConflict && posConflict) {
        pairs.push({ scheduleAId: a.id, scheduleBId: b.id });
        conflictedIds.add(a.id);
        conflictedIds.add(b.id);
      }
    }
  }

  return { conflictedIds, pairs };
}
