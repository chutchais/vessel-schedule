import { classifySchedules } from "./layout";
import { detectConflicts } from "./conflicts";
import type { PlannerBerth, ValidatedSchedule } from "./types";

export type ConflictItem = {
  /** Stable unique ID for this pair: `${scheduleAId}__${scheduleBId}` */
  id: string;
  berthId: string;
  berthName: string;
  scheduleAId: string;
  scheduleBId: string;
  vesselAName: string;
  vesselBName: string;
  serviceAName: string | null;
  voyageANumber: string | null;
  serviceBName: string | null;
  voyageBNumber: string | null;
  /** max(startTimeA, startTimeB) — the actual overlap window start */
  overlapStart: Date;
  /** min(endTimeA, endTimeB) — the actual overlap window end */
  overlapEnd: Date;
  /** max(positionStartA, positionStartB) — overlapping metre range start */
  overlapPositionStart: number;
  /** min(positionEndA, positionEndB) — overlapping metre range end */
  overlapPositionEnd: number;
};

export type ConflictGroup = {
  berthId: string;
  berthName: string;
  conflicts: ConflictItem[];
  earliestOverlapStart: Date;
};

/**
 * Build enriched conflict groups from berth data.
 *
 * - Reuses classifySchedules + detectConflicts — the same engine as the canvas.
 * - Cancelled schedules are excluded (detectConflicts handles this).
 * - Groups by berth, sorted by earliest overlap time within each group.
 * - Groups themselves are sorted by their earliest conflict time.
 * - All calculations are in domain values (metres, UTC dates), never pixels.
 */
export function buildConflictGroups(berths: PlannerBerth[]): ConflictGroup[] {
  const groups: ConflictGroup[] = [];

  for (const berth of berths) {
    const { valid } = classifySchedules(berth.schedules, berth.berthLength);
    const { pairs } = detectConflicts(valid);

    if (pairs.length === 0) continue;

    const scheduleMap = new Map<string, ValidatedSchedule>(valid.map((s) => [s.id, s]));
    const conflicts: ConflictItem[] = [];

    for (const pair of pairs) {
      const a = scheduleMap.get(pair.scheduleAId);
      const b = scheduleMap.get(pair.scheduleBId);
      if (!a || !b) continue;

      const overlapStart = a.startTime > b.startTime ? a.startTime : b.startTime;
      const overlapEnd = a.endTime < b.endTime ? a.endTime : b.endTime;
      const overlapPositionStart =
        a.positionStart > b.positionStart ? a.positionStart : b.positionStart;
      const overlapPositionEnd = a.positionEnd < b.positionEnd ? a.positionEnd : b.positionEnd;

      conflicts.push({
        id: `${pair.scheduleAId}__${pair.scheduleBId}`,
        berthId: berth.id,
        berthName: berth.name,
        scheduleAId: pair.scheduleAId,
        scheduleBId: pair.scheduleBId,
        vesselAName: a.vesselName,
        vesselBName: b.vesselName,
        serviceAName: a.serviceName,
        voyageANumber: a.voyageNumber,
        serviceBName: b.serviceName,
        voyageBNumber: b.voyageNumber,
        overlapStart,
        overlapEnd,
        overlapPositionStart,
        overlapPositionEnd,
      });
    }

    // Within each berth, sort by earliest overlap start
    conflicts.sort((x, y) => x.overlapStart.getTime() - y.overlapStart.getTime());

    groups.push({
      berthId: berth.id,
      berthName: berth.name,
      conflicts,
      earliestOverlapStart: conflicts[0]!.overlapStart,
    });
  }

  // Sort groups by earliest conflict time across all berths
  groups.sort((a, b) => a.earliestOverlapStart.getTime() - b.earliestOverlapStart.getTime());

  return groups;
}

/** Flatten all conflict items from groups into a single ordered list. */
export function flattenConflicts(groups: ConflictGroup[]): ConflictItem[] {
  return groups.flatMap((g) => g.conflicts);
}

/** Collect all schedule IDs involved in any conflict. */
export function getConflictedScheduleIds(groups: ConflictGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const conflict of group.conflicts) {
      ids.add(conflict.scheduleAId);
      ids.add(conflict.scheduleBId);
    }
  }
  return ids;
}
