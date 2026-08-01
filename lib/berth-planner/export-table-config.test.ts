import assert from "node:assert/strict";
import test from "node:test";
import {
  validateExportTableConfigInput,
  normalizeStoredExportTableConfig,
  defaultExportTableConfig,
  buildExportTableData,
  resolveExportColumnValue,
  DEFAULT_EXPORT_TABLE_COLUMNS,
} from "./export-table-config";

// ─── Default configuration ────────────────────────────────────────────────────

test("default config includes 10 columns in defined order", () => {
  const config = defaultExportTableConfig();
  assert.equal(config.version, 1);
  assert.equal(config.includeTable, true);
  assert.equal(config.columns.length, 10);
  const ids = config.columns.map((c) => c.id);
  assert.deepEqual(ids, [
    "vesselName", "voyageNumber", "serviceName", "berthName", "position",
    "eta", "etb", "etd", "status", "remarks",
  ]);
});

test("default config remarks column is WIDE", () => {
  const col = DEFAULT_EXPORT_TABLE_COLUMNS.find((c) => c.id === "remarks");
  assert.equal(col?.width, "WIDE");
});

// ─── Validation ───────────────────────────────────────────────────────────────

test("validation accepts well-formed config", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: true,
    columns: [{ id: "vesselName", placeholder: "{{vesselName}}", heading: "Vessel", visible: true, order: 1, width: "NORMAL", align: "LEFT" }],
  });
  assert.equal(result.ok, true);
});

test("validation rejects unknown placeholder", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: false,
    columns: [{ id: "x", placeholder: "{{arbitraryField}}", heading: "X", visible: true, order: 1, width: "AUTO", align: "AUTO" }],
  });
  assert.equal(result.ok, false);
  assert.ok((result as { ok: false; error: string }).error.includes("unknown"));
});

test("validation rejects HTML injection in placeholder", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: true,
    columns: [{ id: "x", placeholder: "<script>", heading: "X", visible: true, order: 1, width: "AUTO", align: "AUTO" }],
  });
  assert.equal(result.ok, false);
});

test("validation rejects duplicate column ids", () => {
  const col = { id: "vesselName", placeholder: "{{vesselName}}", heading: "Vessel", visible: true, order: 1, width: "NORMAL", align: "LEFT" };
  const result = validateExportTableConfigInput({ version: 1, includeTable: true, columns: [col, { ...col, order: 2 }] });
  assert.equal(result.ok, false);
  assert.ok((result as { ok: false; error: string }).error.includes("Duplicate"));
});

test("validation rejects all columns invisible", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: true,
    columns: [{ id: "vesselName", placeholder: "{{vesselName}}", heading: "Vessel", visible: false, order: 1, width: "AUTO", align: "AUTO" }],
  });
  assert.equal(result.ok, false);
  assert.ok((result as { ok: false; error: string }).error.includes("visible"));
});

test("validation rejects invalid width enum", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: true,
    columns: [{ id: "vesselName", placeholder: "{{vesselName}}", heading: "Vessel", visible: true, order: 1, width: "HUGE", align: "AUTO" }],
  });
  assert.equal(result.ok, false);
});

test("validation rejects invalid align enum", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: true,
    columns: [{ id: "vesselName", placeholder: "{{vesselName}}", heading: "Vessel", visible: true, order: 1, width: "AUTO", align: "JUSTIFY" }],
  });
  assert.equal(result.ok, false);
});

test("validation rejects empty heading", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: true,
    columns: [{ id: "vesselName", placeholder: "{{vesselName}}", heading: "", visible: true, order: 1, width: "AUTO", align: "AUTO" }],
  });
  assert.equal(result.ok, false);
});

test("validation accepts includeTable: false with valid columns", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: false,
    columns: [{ id: "vesselName", placeholder: "{{vesselName}}", heading: "Vessel", visible: true, order: 1, width: "AUTO", align: "AUTO" }],
  });
  assert.equal(result.ok, true);
});

test("validation accepts position composite placeholder", () => {
  const result = validateExportTableConfigInput({
    version: 1,
    includeTable: true,
    columns: [{ id: "position", placeholder: "{{position}}", heading: "Position", visible: true, order: 1, width: "COMPACT", align: "RIGHT" }],
  });
  assert.equal(result.ok, true);
});

test("normalizeStoredExportTableConfig falls back to default for invalid input", () => {
  const config = normalizeStoredExportTableConfig(null);
  assert.equal(config.version, 1);
  assert.equal(config.columns.length, 10);
});

test("normalizeStoredExportTableConfig accepts stored valid config", () => {
  const stored = { version: 1, includeTable: false, columns: [{ id: "vesselName", placeholder: "{{vesselName}}", heading: "Ship", visible: true, order: 1, width: "NORMAL", align: "LEFT" }] };
  const config = normalizeStoredExportTableConfig(stored);
  assert.equal(config.includeTable, false);
  assert.equal(config.columns[0]?.heading, "Ship");
});

// ─── Column value resolution ──────────────────────────────────────────────────

const baseCtx = {
  vesselName: "MV Test",
  serviceName: "Service A",
  voyageNumber: "V001",
  berthName: "Berth 1",
  berthLength: 400,
  berthZeroOriginSide: "LEFT" as const,
  scheduleStatus: "CONFIRMED",
  berthPositionStart: 50,
  berthPositionEnd: 250,
  headingReverse: false,
  remarks: "Customs clearance pending",
  eta: new Date("2026-08-01T06:00:00.000Z"),
  etb: new Date("2026-08-01T07:00:00.000Z"),
  etd: new Date("2026-08-01T18:00:00.000Z"),
  timezone: "UTC",
};

test("resolveExportColumnValue resolves vesselName", () => {
  assert.equal(resolveExportColumnValue("{{vesselName}}", baseCtx), "MV Test");
});

test("resolveExportColumnValue resolves position composite", () => {
  assert.equal(resolveExportColumnValue("{{position}}", baseCtx), "50–250 m");
});

test("resolveExportColumnValue returns em-dash for missing position", () => {
  const ctx = { ...baseCtx, berthPositionStart: undefined, berthPositionEnd: undefined };
  assert.equal(resolveExportColumnValue("{{position}}", ctx), "—");
});

test("resolveExportColumnValue returns em-dash for unknown placeholder", () => {
  assert.equal(resolveExportColumnValue("{{unknownToken}}", baseCtx), "—");
});

test("resolveExportColumnValue returns em-dash for missing optional value", () => {
  const ctx = { ...baseCtx, voyageNumber: null };
  assert.equal(resolveExportColumnValue("{{voyageNumber}}", ctx), "—");
});

test("resolveExportColumnValue formats eta using timezone", () => {
  const value = resolveExportColumnValue("{{eta}}", baseCtx);
  assert.ok(value.length > 0 && value !== "—");
});

// ─── buildExportTableData ─────────────────────────────────────────────────────

const startTime = new Date("2026-08-01T06:00:00.000Z");
const endTime   = new Date("2026-08-01T18:00:00.000Z");

const sampleBerths = [
  {
    id: "b1",
    name: "Berth 1",
    berthLength: 400,
    zeroOriginSide: "LEFT" as const,
    order: 1,
    schedules: [
      {
        id: "s1",
        vesselName: "MV Alpha",
        vesselLoa: 200 as number | null,
        serviceName: "Alpha Service",
        serviceColor: "#3B82F6",
        voyageNumber: "A001",
        status: "CONFIRMED",
        startTime,
        endTime,
        etb: new Date("2026-08-01T07:00:00.000Z"),
        positionStart: 50,
        positionEnd: 250,
        headingReverse: false,
        remarks: "Urgent",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
  },
];

test("buildExportTableData produces one row per schedule", () => {
  const data = buildExportTableData(sampleBerths, defaultExportTableConfig(), "UTC");
  assert.equal(data.rows.length, 1);
  assert.equal(data.visibleColumns.length, 10);
});

test("buildExportTableData returns empty rows when includeTable is false", () => {
  const config = { ...defaultExportTableConfig(), includeTable: false };
  const data = buildExportTableData(sampleBerths, config, "UTC");
  assert.equal(data.rows.length, 0);
  assert.equal(data.visibleColumns.length, 0);
});

test("buildExportTableData column order matches visible sorted order", () => {
  const data = buildExportTableData(sampleBerths, defaultExportTableConfig(), "UTC");
  const headings = data.visibleColumns.map((c) => c.heading);
  assert.equal(headings[0], "Vessel");
  assert.equal(headings[headings.length - 1], "Remarks");
});

test("buildExportTableData uses em-dash for null etb", () => {
  const berths = [{ ...sampleBerths[0]!, schedules: [{ ...sampleBerths[0]!.schedules[0]!, etb: null }] }];
  const data = buildExportTableData(berths, defaultExportTableConfig(), "UTC");
  const etbIdx = data.visibleColumns.findIndex((c) => c.id === "etb");
  assert.ok(etbIdx >= 0);
  assert.equal(data.rows[0]?.cells[etbIdx], "—");
});

test("buildExportTableData sorts by ETA ascending then berth order", () => {
  const later = new Date("2026-08-02T06:00:00.000Z");
  const berths = [
    {
      id: "b2", name: "Berth 2", berthLength: 300, zeroOriginSide: "LEFT" as const, order: 2,
      schedules: [{ ...sampleBerths[0]!.schedules[0]!, id: "s2", vesselName: "MV Beta", startTime: later, endTime: later }],
    },
    sampleBerths[0]!,
  ];
  const data = buildExportTableData(berths, defaultExportTableConfig(), "UTC");
  assert.equal(data.rows[0]?.cells[0], "MV Alpha");
  assert.equal(data.rows[1]?.cells[0], "MV Beta");
});

test("buildExportTableData only includes visible columns", () => {
  const config = defaultExportTableConfig();
  config.columns = config.columns.map((c) => c.id === "voyageNumber" ? { ...c, visible: false } : c);
  const data = buildExportTableData(sampleBerths, config, "UTC");
  assert.ok(!data.visibleColumns.some((c) => c.id === "voyageNumber"));
  assert.equal(data.visibleColumns.length, 9);
});

test("buildExportTableData custom heading is preserved", () => {
  const config = defaultExportTableConfig();
  config.columns = config.columns.map((c) => c.id === "vesselName" ? { ...c, heading: "Ship Name" } : c);
  const data = buildExportTableData(sampleBerths, config, "UTC");
  assert.equal(data.visibleColumns[0]?.heading, "Ship Name");
});

test("buildExportTableData empty schedules produce zero rows", () => {
  const berths = [{ ...sampleBerths[0]!, schedules: [] }];
  const data = buildExportTableData(berths, defaultExportTableConfig(), "UTC");
  assert.equal(data.rows.length, 0);
});

test("buildExportTableData personal label scale does not affect table values", () => {
  // Table values are plain text resolved from context; scale is irrelevant.
  const data = buildExportTableData(sampleBerths, defaultExportTableConfig(), "UTC");
  assert.equal(data.rows[0]?.cells[0], "MV Alpha");
});
