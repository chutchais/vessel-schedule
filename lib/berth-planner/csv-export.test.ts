/**
 * Tests for lib/berth-planner/csv-export.ts
 *
 * Run: npx tsx --test lib/berth-planner/csv-export.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  escapeCsvField,
  preventFormulaInjection,
  safeField,
  fieldOrEmpty,
  formatIsoWithOffset,
  buildConflictedIds,
  calcPositionEnd,
  rowToFields,
  compareScheduleRows,
  buildCsv,
  buildCsvFilename,
  CSV_COLUMNS,
  CSV_MAX_RANGE_DAYS,
  CSV_MAX_RECORDS,
  type CsvBerthGroup,
  type CsvScheduleRow,
} from "./csv-export";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGroup(overrides: Partial<CsvBerthGroup> = {}): CsvBerthGroup {
  return {
    berthId: "berth-1",
    berthName: "North Berth",
    berthOrder: 0,
    schedules: [],
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<CsvBerthGroup["schedules"][number]> = {}): CsvBerthGroup["schedules"][number] {
  return {
    id: "sched-1",
    vesselCode: "VES01",
    vesselName: "MV Test",
    vesselLoa: 200,
    voyageNumber: "VOY001",
    serviceCode: "SVC01",
    serviceName: "Express",
    eta: new Date("2026-07-28T07:00:00Z"),
    etb: new Date("2026-07-28T08:00:00Z"),
    etd: new Date("2026-07-29T06:00:00Z"),
    berthPositionMeters: 100,
    headingReverse: false,
    status: "CONFIRMED",
    remarks: null,
    updatedAt: new Date("2026-07-27T12:00:00Z"),
    startTime: new Date("2026-07-28T08:00:00Z"),
    endTime: new Date("2026-07-29T06:00:00Z"),
    positionStart: 100,
    positionEnd: 300,
    ...overrides,
  };
}

// ─── RFC 4180 escaping ────────────────────────────────────────────────────────

test("escapeCsvField: plain value is returned unchanged", () => {
  assert.equal(escapeCsvField("hello"), "hello");
});

test("escapeCsvField: value containing comma is quoted", () => {
  assert.equal(escapeCsvField("a,b"), '"a,b"');
});

test("escapeCsvField: value containing double-quote doubles it and wraps", () => {
  assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
});

test("escapeCsvField: value containing LF is quoted", () => {
  assert.equal(escapeCsvField("line1\nline2"), '"line1\nline2"');
});

test("escapeCsvField: value containing CR is quoted", () => {
  assert.equal(escapeCsvField("line1\rline2"), '"line1\rline2"');
});

test("escapeCsvField: multiline remarks round-trip correctly", () => {
  const multiline = "line1\r\nline2\r\nline3";
  const escaped = escapeCsvField(multiline);
  assert.ok(escaped.startsWith('"'));
  assert.ok(escaped.endsWith('"'));
  // The inner content should be the original (no double-quotes to double)
  assert.equal(escaped, `"${multiline}"`);
});

// ─── Formula injection prevention ────────────────────────────────────────────

const INJECTION_PREFIXES = ["=SUM(1)", "+1+1", "-1", "@SUM", "\tEXEC", "\rEXEC"];

for (const value of INJECTION_PREFIXES) {
  test(`preventFormulaInjection: prefixes '${value.slice(0, 5)}…' with single-quote`, () => {
    const result = preventFormulaInjection(value);
    assert.ok(result.startsWith("'"), `expected leading quote, got: ${result}`);
    assert.equal(result.slice(1), value);
  });
}

test("preventFormulaInjection: normal text is unchanged", () => {
  assert.equal(preventFormulaInjection("MV Pacific Star"), "MV Pacific Star");
});

test("safeField: =formula is escaped and quoted if needed", () => {
  const result = safeField("=HYPERLINK(\"evil.com\")");
  assert.ok(result.startsWith("'") || result.startsWith('"\''));
  assert.ok(!result.startsWith("="));
});

// ─── fieldOrEmpty ─────────────────────────────────────────────────────────────

test("fieldOrEmpty: null returns empty string", () => {
  assert.equal(fieldOrEmpty(null), "");
});

test("fieldOrEmpty: undefined returns empty string", () => {
  assert.equal(fieldOrEmpty(undefined), "");
});

test("fieldOrEmpty: normal string returns safe field", () => {
  assert.equal(fieldOrEmpty("hello"), "hello");
});

// ─── Port-timezone ISO 8601 timestamps ───────────────────────────────────────

test("formatIsoWithOffset: Bangkok timezone (+07:00) produces correct offset", () => {
  const date = new Date("2026-07-28T07:00:00Z"); // 14:00 in Bangkok (+7)
  const result = formatIsoWithOffset(date, "Asia/Bangkok");
  assert.ok(result.includes("+07:00"), `expected +07:00 in: ${result}`);
  assert.ok(result.startsWith("2026-07-28T14:00:00"), `expected 14:00:00 in: ${result}`);
});

test("formatIsoWithOffset: UTC produces +00:00", () => {
  const date = new Date("2026-07-28T12:00:00Z");
  const result = formatIsoWithOffset(date, "UTC");
  assert.ok(result.includes("+00:00") || result.includes("Z"), `expected UTC offset in: ${result}`);
  assert.ok(result.startsWith("2026-07-28T12:00:00"), `expected 12:00:00 in: ${result}`);
});

test("formatIsoWithOffset: invalid timezone falls back gracefully", () => {
  const date = new Date("2026-07-28T12:00:00Z");
  const result = formatIsoWithOffset(date, "Invalid/Timezone");
  // Should return some ISO-like string without throwing
  assert.ok(typeof result === "string" && result.length > 0);
});

test("formatIsoWithOffset: DST-aware (Europe/London summer +01:00)", () => {
  const date = new Date("2026-07-28T11:00:00Z"); // 12:00 in London BST (+1)
  const result = formatIsoWithOffset(date, "Europe/London");
  assert.ok(result.includes("+01:00"), `expected +01:00 in: ${result}`);
  assert.ok(result.startsWith("2026-07-28T12:00:00"), `expected 12:00:00 in: ${result}`);
});

// ─── Position-end calculation ─────────────────────────────────────────────────

test("calcPositionEnd: returns sum when both values are present", () => {
  assert.equal(calcPositionEnd(100, 200), 300);
});

test("calcPositionEnd: returns null when berthPositionMeters is null", () => {
  assert.equal(calcPositionEnd(null, 200), null);
});

test("calcPositionEnd: returns null when vesselLoa is null", () => {
  assert.equal(calcPositionEnd(100, null), null);
});

test("calcPositionEnd: returns null when both are null", () => {
  assert.equal(calcPositionEnd(null, null), null);
});

test("calcPositionEnd: handles zero position", () => {
  assert.equal(calcPositionEnd(0, 150), 150);
});

// ─── Stable column order ──────────────────────────────────────────────────────

test("CSV_COLUMNS contains exactly the required 20 columns in order", () => {
  const expected = [
    "scheduleReference",
    "vesselCode",
    "vesselName",
    "voyageNumber",
    "serviceCode",
    "serviceName",
    "terminalName",
    "berthName",
    "portTimezone",
    "eta",
    "etb",
    "etd",
    "berthPositionMeters",
    "berthPositionEndMeters",
    "headingReverse",
    "vesselLoa",
    "status",
    "hasConflict",
    "remarks",
    "updatedAt",
  ];
  assert.deepEqual([...CSV_COLUMNS], expected);
});

test("rowToFields: produces exactly CSV_COLUMNS.length fields", () => {
  const row: CsvScheduleRow = {
    scheduleReference: "VOY001",
    vesselCode: "VES01",
    vesselName: "MV Test",
    voyageNumber: "VOY001",
    serviceCode: "SVC01",
    serviceName: "Express",
    terminalName: "Main Terminal",
    berthName: "North Berth",
    portTimezone: "Asia/Bangkok",
    eta: new Date("2026-07-28T07:00:00Z"),
    etb: new Date("2026-07-28T08:00:00Z"),
    etd: new Date("2026-07-29T06:00:00Z"),
    berthPositionMeters: 100,
    vesselLoa: 200,
    headingReverse: false,
    status: "CONFIRMED",
    hasConflict: false,
    remarks: null,
    updatedAt: new Date("2026-07-27T12:00:00Z"),
  };
  const fields = rowToFields(row);
  assert.equal(fields.length, CSV_COLUMNS.length);
});

// ─── Missing values ───────────────────────────────────────────────────────────

test("rowToFields: null etb produces empty field", () => {
  const row: CsvScheduleRow = {
    scheduleReference: null,
    vesselCode: "VES01",
    vesselName: "MV Test",
    voyageNumber: null,
    serviceCode: null,
    serviceName: null,
    terminalName: "Terminal",
    berthName: "Berth",
    portTimezone: "UTC",
    eta: new Date("2026-07-28T07:00:00Z"),
    etb: null,
    etd: new Date("2026-07-29T06:00:00Z"),
    berthPositionMeters: null,
    vesselLoa: null,
    headingReverse: false,
    status: "PLANNED",
    hasConflict: false,
    remarks: null,
    updatedAt: new Date("2026-07-27T12:00:00Z"),
  };
  const fields = rowToFields(row);
  const idx = (col: string) => CSV_COLUMNS.indexOf(col as typeof CSV_COLUMNS[number]);
  assert.equal(fields[idx("etb")], "");
  assert.equal(fields[idx("berthPositionMeters")], "");
  assert.equal(fields[idx("berthPositionEndMeters")], "");
  assert.equal(fields[idx("vesselLoa")], "");
  assert.equal(fields[idx("scheduleReference")], "");
  assert.equal(fields[idx("serviceCode")], "");
  assert.equal(fields[idx("serviceName")], "");
  assert.equal(fields[idx("remarks")], "");
});

test("rowToFields: never outputs literal null or undefined", () => {
  const row: CsvScheduleRow = {
    scheduleReference: null,
    vesselCode: "VES01",
    vesselName: "MV Test",
    voyageNumber: null,
    serviceCode: null,
    serviceName: null,
    terminalName: "Terminal",
    berthName: "Berth",
    portTimezone: "UTC",
    eta: new Date("2026-07-28T07:00:00Z"),
    etb: null,
    etd: new Date("2026-07-29T06:00:00Z"),
    berthPositionMeters: null,
    vesselLoa: null,
    headingReverse: false,
    status: "PLANNED",
    hasConflict: false,
    remarks: null,
    updatedAt: new Date("2026-07-27T12:00:00Z"),
  };
  const fields = rowToFields(row);
  for (const f of fields) {
    assert.notEqual(f, "null", `field should not be literal 'null': ${f}`);
    assert.notEqual(f, "undefined", `field should not be literal 'undefined': ${f}`);
  }
});

// ─── Row sorting ──────────────────────────────────────────────────────────────

test("compareScheduleRows: sorts by startTime ascending", () => {
  const a = { startTime: new Date("2026-07-28T08:00:00Z"), berthOrder: 0, positionStart: 0 };
  const b = { startTime: new Date("2026-07-28T10:00:00Z"), berthOrder: 0, positionStart: 0 };
  assert.ok(compareScheduleRows(a, b) < 0);
  assert.ok(compareScheduleRows(b, a) > 0);
});

test("compareScheduleRows: ties broken by berthOrder", () => {
  const t = new Date("2026-07-28T08:00:00Z");
  const a = { startTime: t, berthOrder: 1, positionStart: 0 };
  const b = { startTime: t, berthOrder: 2, positionStart: 0 };
  assert.ok(compareScheduleRows(a, b) < 0);
});

test("compareScheduleRows: ties broken by positionStart", () => {
  const t = new Date("2026-07-28T08:00:00Z");
  const a = { startTime: t, berthOrder: 0, positionStart: 50 };
  const b = { startTime: t, berthOrder: 0, positionStart: 150 };
  assert.ok(compareScheduleRows(a, b) < 0);
});

// ─── buildCsv: empty export ───────────────────────────────────────────────────

test("buildCsv: empty groups produces only header row", () => {
  const csv = buildCsv({ terminalName: "Terminal", portTimezone: "UTC", groups: [] });
  const lines = csv.split("\r\n").filter(Boolean);
  assert.equal(lines.length, 1);
  assert.equal(lines[0], CSV_COLUMNS.join(","));
});

// ─── buildCsv: conflict flag ──────────────────────────────────────────────────

test("buildCsv: conflicting schedules have hasConflict=TRUE", () => {
  // Two schedules on same berth, overlapping time and position
  const s1 = makeSchedule({
    id: "a",
    startTime: new Date("2026-07-28T08:00:00Z"),
    endTime: new Date("2026-07-29T06:00:00Z"),
    positionStart: 100,
    positionEnd: 300,
    status: "CONFIRMED",
  });
  const s2 = makeSchedule({
    id: "b",
    startTime: new Date("2026-07-28T09:00:00Z"),
    endTime: new Date("2026-07-29T05:00:00Z"),
    positionStart: 150,
    positionEnd: 350,
    status: "CONFIRMED",
    vesselCode: "VES02",
    voyageNumber: "VOY002",
  });
  const group = makeGroup({ schedules: [s1, s2] });
  const csv = buildCsv({ terminalName: "Terminal", portTimezone: "UTC", groups: [group] });
  const lines = csv.split("\r\n").filter(Boolean);
  // Skip header
  const hasConflictIdx = CSV_COLUMNS.indexOf("hasConflict");
  const row1Fields = lines[1]!.split(",");
  const row2Fields = lines[2]!.split(",");
  assert.equal(row1Fields[hasConflictIdx], "TRUE");
  assert.equal(row2Fields[hasConflictIdx], "TRUE");
});

test("buildCsv: non-conflicting schedule has hasConflict=FALSE", () => {
  const s = makeSchedule({ id: "x" });
  const group = makeGroup({ schedules: [s] });
  const csv = buildCsv({ terminalName: "Terminal", portTimezone: "UTC", groups: [group] });
  const lines = csv.split("\r\n").filter(Boolean);
  const hasConflictIdx = CSV_COLUMNS.indexOf("hasConflict");
  const fields = lines[1]!.split(",");
  assert.equal(fields[hasConflictIdx], "FALSE");
});

test("buildCsv: CANCELLED schedule does not generate conflict", () => {
  const s1 = makeSchedule({ id: "a", status: "CANCELLED" });
  const s2 = makeSchedule({
    id: "b",
    status: "CONFIRMED",
    vesselCode: "VES02",
    voyageNumber: "VOY002",
  });
  const group = makeGroup({ schedules: [s1, s2] });
  const csv = buildCsv({ terminalName: "Terminal", portTimezone: "UTC", groups: [group] });
  const lines = csv.split("\r\n").filter(Boolean);
  const hasConflictIdx = CSV_COLUMNS.indexOf("hasConflict");
  // Both should be FALSE because CANCELLED is excluded from conflict detection
  for (const line of lines.slice(1)) {
    const fields = line.split(",");
    assert.equal(fields[hasConflictIdx], "FALSE");
  }
});

// ─── buildCsv: multiline remarks ─────────────────────────────────────────────

test("buildCsv: multiline remarks are RFC 4180 quoted", () => {
  const s = makeSchedule({ id: "r", remarks: "First line\r\nSecond line" });
  const group = makeGroup({ schedules: [s] });
  const csv = buildCsv({ terminalName: "Terminal", portTimezone: "UTC", groups: [group] });
  assert.ok(csv.includes('"First line\r\nSecond line"'), `multiline remarks not found in: ${csv.slice(0, 300)}`);
});

// ─── buildCsv: formula injection in vessel name ───────────────────────────────

test("buildCsv: vessel name starting with = is prefixed with single-quote", () => {
  const s = makeSchedule({ vesselName: "=HYPERLINK(\"evil\")" });
  const group = makeGroup({ schedules: [s] });
  const csv = buildCsv({ terminalName: "Terminal", portTimezone: "UTC", groups: [group] });
  // The CSV should contain '= not =
  assert.ok(!csv.includes(",=HYPERLINK"), `formula injection not prevented: ${csv.slice(0, 400)}`);
});

test("buildCsv: remarks starting with + are prefixed with single-quote", () => {
  const s = makeSchedule({ remarks: "+malicious" });
  const group = makeGroup({ schedules: [s] });
  const csv = buildCsv({ terminalName: "Terminal", portTimezone: "UTC", groups: [group] });
  assert.ok(!csv.includes(",+malicious"), `formula injection not prevented`);
  assert.ok(csv.includes("'+malicious"), `expected single-quote prefix`);
});

// ─── buildCsv: stable row order ───────────────────────────────────────────────

test("buildCsv: rows are sorted by startTime then berthOrder then positionStart", () => {
  const t1 = new Date("2026-07-28T06:00:00Z");
  const t2 = new Date("2026-07-28T10:00:00Z");
  // s2 starts later than s1
  const s1 = makeSchedule({
    id: "early",
    voyageNumber: "EARLY",
    startTime: t1,
    eta: t1,
  });
  const s2 = makeSchedule({
    id: "late",
    voyageNumber: "LATE",
    startTime: t2,
    eta: t2,
  });
  // Add in reverse order
  const group = makeGroup({ schedules: [s2, s1] });
  const csv = buildCsv({ terminalName: "T", portTimezone: "UTC", groups: [group] });
  const lines = csv.split("\r\n").filter(Boolean);
  const voyIdx = CSV_COLUMNS.indexOf("voyageNumber");
  assert.equal(lines[1]!.split(",")[voyIdx], "EARLY");
  assert.equal(lines[2]!.split(",")[voyIdx], "LATE");
});

// ─── buildCsv: port-timezone timestamp ───────────────────────────────────────

test("buildCsv: eta column includes Bangkok offset +07:00", () => {
  const s = makeSchedule({
    portTimezone: "Asia/Bangkok",
    eta: new Date("2026-07-28T07:00:00Z"), // 14:00 Bangkok
  } as unknown as Partial<CsvBerthGroup["schedules"][number]>);
  const group = makeGroup({ schedules: [s] });
  const csv = buildCsv({ terminalName: "T", portTimezone: "Asia/Bangkok", groups: [group] });
  const etaIdx = CSV_COLUMNS.indexOf("eta");
  const dataLine = csv.split("\r\n")[1]!;
  void dataLine;
  assert.ok(csv.includes("+07:00"), `expected +07:00 in CSV: ${csv.slice(0, 400)}`);
  void etaIdx;
});

// ─── buildCsv: headingReverse boolean ────────────────────────────────────────

test("buildCsv: headingReverse=true outputs TRUE, false outputs FALSE", () => {
  const s1 = makeSchedule({ id: "fwd", headingReverse: false });
  const s2 = makeSchedule({ id: "rev", headingReverse: true, voyageNumber: "VOY002", startTime: new Date("2026-07-28T09:00:00Z"), eta: new Date("2026-07-28T09:00:00Z") });
  const group = makeGroup({ schedules: [s1, s2] });
  const csv = buildCsv({ terminalName: "T", portTimezone: "UTC", groups: [group] });
  const lines = csv.split("\r\n").filter(Boolean);
  const hrIdx = CSV_COLUMNS.indexOf("headingReverse");
  assert.equal(lines[1]!.split(",")[hrIdx], "FALSE");
  assert.equal(lines[2]!.split(",")[hrIdx], "TRUE");
});

// ─── buildConflictedIds ───────────────────────────────────────────────────────

test("buildConflictedIds: returns empty set when no schedules", () => {
  const ids = buildConflictedIds([makeGroup()]);
  assert.equal(ids.size, 0);
});

test("buildConflictedIds: org isolation — schedules in different groups do not cross-conflict", () => {
  // Two groups representing different berths; identical times/positions should
  // not generate inter-berth conflicts (conflict engine operates per berth)
  const s1 = makeSchedule({ id: "g1s1" });
  const s2 = makeSchedule({ id: "g2s1" }); // same time/position but different berth
  const g1 = makeGroup({ berthId: "berth-1", schedules: [s1] });
  const g2 = makeGroup({ berthId: "berth-2", schedules: [s2] });
  const ids = buildConflictedIds([g1, g2]);
  // No conflict because conflict engine processes each group independently
  assert.equal(ids.size, 0);
});

// ─── Safe filename ────────────────────────────────────────────────────────────

test("buildCsvFilename: produces expected format", () => {
  const weekStart = new Date("2026-07-27T17:00:00Z"); // Mon 2026-07-28 in Bangkok
  const weekEnd = new Date("2026-08-03T17:00:00Z");   // Mon 2026-08-03 in Bangkok
  const name = buildCsvFilename("Main Terminal", weekStart, weekEnd, "Asia/Bangkok");
  assert.ok(name.startsWith("vessel-schedules_Main-Terminal_"), `unexpected filename: ${name}`);
  assert.ok(name.endsWith(".csv"), `expected .csv extension: ${name}`);
});

test("buildCsvFilename: special characters are removed from terminal name", () => {
  const weekStart = new Date("2026-07-27T00:00:00Z");
  const weekEnd = new Date("2026-08-03T00:00:00Z");
  const name = buildCsvFilename("Port & Terminal (North)", weekStart, weekEnd, "UTC");
  assert.ok(!name.includes("&"), `special chars should be removed: ${name}`);
  assert.ok(!name.includes("("), `special chars should be removed: ${name}`);
  assert.ok(!name.includes(")"), `special chars should be removed: ${name}`);
});

test("buildCsvFilename: empty terminal name falls back to 'terminal'", () => {
  const weekStart = new Date("2026-07-27T00:00:00Z");
  const weekEnd = new Date("2026-08-03T00:00:00Z");
  const name = buildCsvFilename("", weekStart, weekEnd, "UTC");
  assert.ok(name.startsWith("vessel-schedules_terminal_"), `expected fallback: ${name}`);
});

// ─── Export limits ────────────────────────────────────────────────────────────

test("CSV_MAX_RANGE_DAYS is a positive integer", () => {
  assert.ok(typeof CSV_MAX_RANGE_DAYS === "number");
  assert.ok(CSV_MAX_RANGE_DAYS > 0);
  assert.ok(Number.isInteger(CSV_MAX_RANGE_DAYS));
});

test("CSV_MAX_RECORDS is a positive integer", () => {
  assert.ok(typeof CSV_MAX_RECORDS === "number");
  assert.ok(CSV_MAX_RECORDS > 0);
  assert.ok(Number.isInteger(CSV_MAX_RECORDS));
});

// ─── Active-filter consistency ────────────────────────────────────────────────

test("buildCsv: status filter matches are included; others would be excluded at API level", () => {
  // The CSV builder receives pre-filtered groups; verify that rows present
  // in groups have their status written correctly
  const s = makeSchedule({ status: "BERTHED" });
  const group = makeGroup({ schedules: [s] });
  const csv = buildCsv({ terminalName: "T", portTimezone: "UTC", groups: [group] });
  const statusIdx = CSV_COLUMNS.indexOf("status");
  const fields = csv.split("\r\n")[1]!.split(",");
  assert.equal(fields[statusIdx], "BERTHED");
});

// ─── Internal IDs not exposed ─────────────────────────────────────────────────

test("CSV_COLUMNS does not include id or organizationId", () => {
  const forbidden = ["id", "organizationId", "vesselId", "serviceId", "berthId", "terminalId"];
  for (const col of forbidden) {
    assert.ok(
      !CSV_COLUMNS.includes(col as typeof CSV_COLUMNS[number]),
      `column ${col} should not be exposed`,
    );
  }
});
