import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConflictGroups,
  flattenConflicts,
  getConflictedScheduleIds,
  type ConflictItem,
} from "./conflict-panel";
import type { PlannerBerth, PlannerSchedule } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSchedule(
  id: string,
  eta: string,
  etd: string,
  berthPositionMeters: number,
  vesselLoa: number,
  status: "PLANNED" | "CONFIRMED" | "ARRIVED" | "BERTHED" | "DEPARTED" | "CANCELLED" = "PLANNED",
  overrides: Partial<{
    vesselName: string;
    serviceName: string | null;
    voyageNumber: string | null;
  }> = {},
) {
  return {
    id,
    vesselName: overrides.vesselName ?? `Vessel ${id}`,
    vesselLoa,
    vesselColor: "#3B82F6",
    serviceName: overrides.serviceName ?? null,
    serviceColor: null,
    status,
    eta: new Date(eta),
    etb: null,
    etd: new Date(etd),
    berthPositionMeters,
    headingReverse: false,
    berthId: "b1",
    voyageNumber: overrides.voyageNumber ?? null,
  };
}

function makeBerth(id: string, name: string, schedules: PlannerSchedule[]): PlannerBerth {
  return {
    id,
    name,
    berthLength: 500,
    zeroOriginSide: "LEFT",
    order: 0,
    schedules,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("returns empty array when no berths have conflicts", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T08:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T08:00:00Z", "2026-07-28T16:00:00Z", 0, 100),
    ]),
  ];
  // s1 ends exactly when s2 starts — strict inequality means no overlap
  assert.deepEqual(buildConflictGroups(berths), []);
});

test("detects a simple time+position conflict", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  const groups = buildConflictGroups(berths);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.berthName, "Berth 1");
  assert.equal(groups[0]!.conflicts.length, 1);
});

test("calculates overlap time range correctly", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  const conflict = buildConflictGroups(berths)[0]!.conflicts[0]!;
  assert.equal(conflict.overlapStart.toISOString(), "2026-07-28T06:00:00.000Z");
  assert.equal(conflict.overlapEnd.toISOString(), "2026-07-28T12:00:00.000Z");
});

test("calculates overlap position range correctly", () => {
  // s1: pos 0-100, s2: pos 50-150 → overlap 50-100
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  const conflict = buildConflictGroups(berths)[0]!.conflicts[0]!;
  assert.equal(conflict.overlapPositionStart, 50);
  assert.equal(conflict.overlapPositionEnd, 100);
});

test("excludes CANCELLED schedules from conflict detection", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100, "CANCELLED"),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  assert.deepEqual(buildConflictGroups(berths), []);
});

test("excludes schedules with missing LOA from conflict detection", () => {
  const s1: PlannerSchedule = {
    ...makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
    vesselLoa: null,
  };
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      s1,
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  // s1 is invalid (no LOA), so no conflict
  assert.deepEqual(buildConflictGroups(berths), []);
});

test("groups conflicts by berth", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth Alpha", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
    makeBerth("b2", "Berth Beta", [
      makeSchedule("s3", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s4", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  const groups = buildConflictGroups(berths);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.berthId, "b1");
  assert.equal(groups[1]!.berthId, "b2");
});

test("conflicts within a berth are sorted by earliest overlap start", () => {
  // Three schedules: s1 conflicts with both s2 and s3, but s3 overlap starts later
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T20:00:00Z", 0, 200),
      makeSchedule("s2", "2026-07-28T02:00:00Z", "2026-07-28T06:00:00Z", 100, 80),
      makeSchedule("s3", "2026-07-28T10:00:00Z", "2026-07-28T14:00:00Z", 100, 80),
    ]),
  ];
  const conflicts = buildConflictGroups(berths)[0]!.conflicts;
  assert.equal(conflicts.length, 2);
  assert.ok(
    conflicts[0]!.overlapStart.getTime() <= conflicts[1]!.overlapStart.getTime(),
    "conflicts should be sorted by overlap start ascending",
  );
  assert.equal(conflicts[0]!.overlapStart.toISOString(), "2026-07-28T02:00:00.000Z");
  assert.equal(conflicts[1]!.overlapStart.toISOString(), "2026-07-28T10:00:00.000Z");
});

test("groups are sorted by earliest conflict time across berths", () => {
  // b2 has an earlier conflict than b1
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T10:00:00Z", "2026-07-28T20:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T14:00:00Z", "2026-07-28T22:00:00Z", 50, 100),
    ]),
    makeBerth("b2", "Berth 2", [
      makeSchedule("s3", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s4", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  const groups = buildConflictGroups(berths);
  assert.equal(groups[0]!.berthId, "b2", "b2 should come first (earlier conflict)");
  assert.equal(groups[1]!.berthId, "b1");
});

test("records vessel names, service and voyage for each conflict item", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100, "PLANNED", {
        vesselName: "MV Alpha",
        serviceName: "AEX",
        voyageNumber: "V001",
      }),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100, "PLANNED", {
        vesselName: "MV Beta",
        serviceName: null,
        voyageNumber: "V002",
      }),
    ]),
  ];
  const conflict = buildConflictGroups(berths)[0]!.conflicts[0]!;
  assert.equal(conflict.vesselAName, "MV Alpha");
  assert.equal(conflict.serviceAName, "AEX");
  assert.equal(conflict.voyageANumber, "V001");
  assert.equal(conflict.vesselBName, "MV Beta");
  assert.equal(conflict.serviceBName, null);
  assert.equal(conflict.voyageBNumber, "V002");
});

test("flattenConflicts returns all conflicts in group order", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
    makeBerth("b2", "Berth 2", [
      makeSchedule("s3", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s4", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  const groups = buildConflictGroups(berths);
  const flat = flattenConflicts(groups);
  assert.equal(flat.length, 2);
  assert.equal(flat[0]!.berthId, groups[0]!.berthId);
  assert.equal(flat[1]!.berthId, groups[1]!.berthId);
});

test("getConflictedScheduleIds collects all IDs from all groups", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
    makeBerth("b2", "Berth 2", [
      makeSchedule("s3", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s4", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  const groups = buildConflictGroups(berths);
  const ids = getConflictedScheduleIds(groups);
  assert.ok(ids.has("s1"));
  assert.ok(ids.has("s2"));
  assert.ok(ids.has("s3"));
  assert.ok(ids.has("s4"));
});

test("getConflictedScheduleIds returns empty set when no conflicts", () => {
  const groups = buildConflictGroups([]);
  const ids = getConflictedScheduleIds(groups);
  assert.equal(ids.size, 0);
});

test("organization isolation: conflicts only detected within same berth (cross-berth schedules never conflict)", () => {
  // s1 is in b1 at pos 0-100, s2 is in b2 at pos 0-100 — same time, same position space
  // but they are in different berths, so no conflict
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
    ]),
    makeBerth("b2", "Berth 2", [
      makeSchedule("s2", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
    ]),
  ];
  // s1 and s2 don't conflict because they're in different berths
  assert.deepEqual(buildConflictGroups(berths), []);
});

test("conflict item id is stable and unique for a pair", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T12:00:00Z", 0, 100),
      makeSchedule("s2", "2026-07-28T06:00:00Z", "2026-07-28T18:00:00Z", 50, 100),
    ]),
  ];
  const conflict = buildConflictGroups(berths)[0]!.conflicts[0]!;
  assert.match(conflict.id, /^s[12]__s[12]$/);
  assert.notEqual(conflict.scheduleAId, conflict.scheduleBId);
});

test("multiple conflicts on same berth each get distinct ids", () => {
  const berths: PlannerBerth[] = [
    makeBerth("b1", "Berth 1", [
      makeSchedule("s1", "2026-07-28T00:00:00Z", "2026-07-28T20:00:00Z", 0, 200),
      makeSchedule("s2", "2026-07-28T02:00:00Z", "2026-07-28T06:00:00Z", 100, 80),
      makeSchedule("s3", "2026-07-28T10:00:00Z", "2026-07-28T14:00:00Z", 100, 80),
    ]),
  ];
  const conflicts = buildConflictGroups(berths)[0]!.conflicts;
  const ids = new Set(conflicts.map((c: ConflictItem) => c.id));
  assert.equal(ids.size, conflicts.length, "each conflict item should have a unique id");
});
