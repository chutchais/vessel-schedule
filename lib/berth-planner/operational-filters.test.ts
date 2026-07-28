import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_OPERATIONAL_FILTERS,
  countSchedules,
  filterPlannerBerths,
  parsePlannerUrlState,
  serializePlannerUrlState,
  shouldClearHiddenSelection,
} from "./operational-filters";
import type { PlannerBerth, PlannerSchedule } from "./types";

function schedule(id: string, overrides: Partial<PlannerSchedule> = {}): PlannerSchedule {
  return {
    id,
    vesselName: `Vessel ${id}`,
    vesselLoa: 100,
    vesselColor: "#000",
    serviceName: "Asia Loop",
    serviceColor: null,
    status: "PLANNED",
    eta: new Date("2026-07-27T00:00:00Z"),
    etb: null,
    etd: new Date("2026-07-27T08:00:00Z"),
    berthPositionMeters: 10,
    headingReverse: false,
    berthId: "b1",
    voyageNumber: "V001",
    ...overrides,
  };
}

const berths: PlannerBerth[] = [{
  id: "b1",
  name: "Berth One",
  berthLength: 300,
  zeroOriginSide: "LEFT",
  order: 1,
  schedules: [
    schedule("ref-alpha", { vesselName: "Ocean Star" }),
    schedule("ref-beta", { vesselName: "Pacific", serviceName: "Europe Loop", status: "CONFIRMED", voyageNumber: "EU42" }),
    schedule("ref-invalid", { vesselName: "Broken Ship", vesselLoa: null }),
  ],
}];

test("searches vessel name, voyage number, and schedule reference", () => {
  for (const query of ["ocean", "eu42", "ref-invalid"]) {
    const result = filterPlannerBerths({ berths, filters: { ...EMPTY_OPERATIONAL_FILTERS, search: query }, conflictedScheduleIds: new Set() });
    assert.equal(countSchedules(result), 1);
  }
});

test("applies combined service, status, and berth filters", () => {
  const result = filterPlannerBerths({
    berths,
    filters: { ...EMPTY_OPERATIONAL_FILTERS, service: "Europe Loop", status: "CONFIRMED", berthId: "b1" },
    conflictedScheduleIds: new Set(),
  });
  assert.deepEqual(result[0]!.schedules.map((item) => item.id), ["ref-beta"]);
});

test("filters conflicts only using shared conflict results", () => {
  const result = filterPlannerBerths({
    berths,
    filters: { ...EMPTY_OPERATIONAL_FILTERS, conflictsOnly: true },
    conflictedScheduleIds: new Set(["ref-alpha"]),
  });
  assert.deepEqual(result[0]!.schedules.map((item) => item.id), ["ref-alpha"]);
});

test("filters incomplete or invalid schedules using placement validation", () => {
  const result = filterPlannerBerths({
    berths,
    filters: { ...EMPTY_OPERATIONAL_FILTERS, invalidOnly: true },
    conflictedScheduleIds: new Set(),
  });
  assert.deepEqual(result[0]!.schedules.map((item) => item.id), ["ref-invalid"]);
});

test("URL state validates values and preserves terminal, week, view, and filters", () => {
  const query = serializePlannerUrlState({
    terminalId: "terminal-1",
    week: "2026-07-27",
    domain: "datetime",
    filters: { ...EMPTY_OPERATIONAL_FILTERS, search: "Ocean", status: "ARRIVED", conflictsOnly: true },
  });
  const parsed = parsePlannerUrlState(new URLSearchParams(query));
  assert.equal(parsed.terminalId, "terminal-1");
  assert.equal(parsed.week, "2026-07-27");
  assert.equal(parsed.domain, "datetime");
  assert.equal(parsed.filters.search, "Ocean");
  assert.equal(parsed.filters.status, "ARRIVED");
  assert.equal(parsed.filters.conflictsOnly, true);

  const invalid = parsePlannerUrlState(new URLSearchParams("week=nope&status=UNKNOWN&view=bad"));
  assert.equal(invalid.week, "");
  assert.equal(invalid.filters.status, "");
  assert.equal(invalid.domain, "position");
});

test("clearing filters restores the total and hidden selection is detected", () => {
  const filtered = filterPlannerBerths({
    berths,
    filters: { ...EMPTY_OPERATIONAL_FILTERS, search: "missing" },
    conflictedScheduleIds: new Set(),
  });
  assert.equal(countSchedules(filtered), 0);
  assert.equal(countSchedules(filterPlannerBerths({ berths, filters: EMPTY_OPERATIONAL_FILTERS, conflictedScheduleIds: new Set() })), 3);
  assert.equal(shouldClearHiddenSelection("ref-alpha", new Set(["ref-beta"])), true);
  assert.equal(shouldClearHiddenSelection("ref-alpha", new Set(["ref-alpha"])), false);
});
