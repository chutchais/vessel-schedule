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
  const active = schedules
    .map((schedule, index) => ({ schedule, index }))
    .filter(({ schedule }) => schedule.status !== "CANCELLED");
  const pairs: ConflictPair[] = [];
  const conflictedIds = new Set<string>();

  // A time-ordered active window avoids comparing schedules whose intervals
  // cannot overlap. The final sort retains the public pair order from the
  // previous nested-loop implementation.
  const byStart = [...active].sort((a, b) =>
    a.schedule.startTime.getTime() - b.schedule.startTime.getTime() || a.index - b.index,
  );
  const activeWindow: typeof byStart = [];
  const orderedPairs: Array<ConflictPair & { firstIndex: number; secondIndex: number }> = [];

  for (const current of byStart) {
    for (let index = activeWindow.length - 1; index >= 0; index--) {
      if (activeWindow[index]!.schedule.endTime <= current.schedule.startTime) activeWindow.splice(index, 1);
    }
    for (const previous of activeWindow) {
      if (!hasPositionOverlap(
        previous.schedule.positionStart,
        previous.schedule.positionEnd,
        current.schedule.positionStart,
        current.schedule.positionEnd,
      )) continue;
      conflictedIds.add(previous.schedule.id);
      conflictedIds.add(current.schedule.id);
      orderedPairs.push({
        scheduleAId: previous.index < current.index ? previous.schedule.id : current.schedule.id,
        scheduleBId: previous.index < current.index ? current.schedule.id : previous.schedule.id,
        firstIndex: Math.min(previous.index, current.index),
        secondIndex: Math.max(previous.index, current.index),
      });
    }
    activeWindow.push(current);
  }

  orderedPairs.sort((a, b) => a.firstIndex - b.firstIndex || a.secondIndex - b.secondIndex);
  for (const { scheduleAId, scheduleBId } of orderedPairs) pairs.push({ scheduleAId, scheduleBId });

  return { conflictedIds, pairs };
}
