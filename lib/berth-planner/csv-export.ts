/**
 * CSV export for the Berth Planner.
 *
 * Produces UTF-8 RFC 4180-compatible CSV. All logic operates on domain data —
 * never on canvas pixels. Timestamps are formatted as ISO 8601 with the port's
 * UTC offset (e.g. "2026-07-28T14:30:00+07:00").
 *
 * ## Column contract
 *
 * | # | Header                  | Source field                                  | Notes                                  |
 * |---|-------------------------|-----------------------------------------------|----------------------------------------|
 * | 1 | scheduleReference       | voyageNumber (best available reference)       | empty when null                        |
 * | 2 | vesselCode              | vessel.code                                   |                                        |
 * | 3 | vesselName              | vessel.name                                   |                                        |
 * | 4 | voyageNumber            | voyageNumber                                  |                                        |
 * | 5 | serviceCode             | service.code                                  | empty when no service                  |
 * | 6 | serviceName             | service.name                                  | empty when no service                  |
 * | 7 | terminalName            | terminal.name                                 |                                        |
 * | 8 | berthName               | berth.name                                    |                                        |
 * | 9 | portTimezone            | port.timezone (IANA)                          |                                        |
 * |10 | eta                     | eta                                           | ISO 8601 with port UTC offset          |
 * |11 | etb                     | etb                                           | ISO 8601 with port UTC offset; empty   |
 * |12 | etd                     | etd                                           | ISO 8601 with port UTC offset          |
 * |13 | berthPositionMeters     | berthPositionMeters                           | integer metres; empty when null        |
 * |14 | berthPositionEndMeters  | berthPositionMeters + vesselLoa               | empty when either is null              |
 * |15 | headingReverse          | headingReverse                                | TRUE / FALSE                           |
 * |16 | vesselLoa               | vessel.lengthOverall                          | decimal metres; empty when null        |
 * |17 | status                  | status                                        |                                        |
 * |18 | hasConflict             | derived via detectConflicts                   | TRUE / FALSE                           |
 * |19 | remarks                 | remarks                                       | may contain newlines (RFC 4180 quoted) |
 * |20 | updatedAt               | updatedAt                                     | ISO 8601 with port UTC offset          |
 */

import type { ScheduleStatus } from "./types";
import { detectConflicts } from "./conflicts";
import type { ValidatedSchedule } from "./types";

// ─── Column definitions ───────────────────────────────────────────────────────

/** Fixed, ordered column headers. Never reorder — changes are breaking. */
export const CSV_COLUMNS = [
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
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

// ─── Domain types for CSV rows ────────────────────────────────────────────────

export type CsvScheduleRow = {
  /** voyage number used as a human-readable schedule reference */
  scheduleReference: string | null;
  vesselCode: string;
  vesselName: string;
  voyageNumber: string | null;
  serviceCode: string | null;
  serviceName: string | null;
  terminalName: string;
  berthName: string;
  portTimezone: string;
  eta: Date;
  etb: Date | null;
  etd: Date;
  berthPositionMeters: number | null;
  vesselLoa: number | null;
  headingReverse: boolean;
  status: ScheduleStatus;
  hasConflict: boolean;
  remarks: string | null;
  updatedAt: Date;
};

export type CsvBerthGroup = {
  berthId: string;
  berthName: string;
  berthOrder: number;
  /** vesselLoa is the vessel's length in metres (may be null) */
  schedules: Array<{
    id: string;
    vesselCode: string;
    vesselName: string;
    vesselLoa: number | null;
    voyageNumber: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    eta: Date;
    etb: Date | null;
    etd: Date;
    berthPositionMeters: number | null;
    headingReverse: boolean;
    status: ScheduleStatus;
    remarks: string | null;
    updatedAt: Date;
    /** Derived: startTime = etb ?? eta (for sorting and conflict engine) */
    startTime: Date;
    endTime: Date;
    positionStart: number;
    positionEnd: number;
  }>;
};

// ─── RFC 4180 helpers ─────────────────────────────────────────────────────────

/**
 * Escape a single CSV field per RFC 4180.
 * Wraps in double-quotes when the value contains commas, double-quotes, CR or LF.
 * Double-quotes within the value are doubled ("").
 */
export function escapeCsvField(value: string): string {
  const needsQuoting = /[",\r\n]/.test(value);
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Prevent spreadsheet formula injection.
 * Prefixes with a single-quote any value that starts with =, +, -, @,
 * a tab character (\t) or a carriage return (\r).
 * The prefix is inside the CSV field value, not a separate cell.
 */
export function preventFormulaInjection(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** Apply formula-injection guard then RFC 4180 escaping. */
export function safeField(raw: string): string {
  return escapeCsvField(preventFormulaInjection(raw));
}

/** Convert a nullable string value to a safe CSV field (empty string for null/undefined). */
export function fieldOrEmpty(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return safeField(value);
}

// ─── Timestamp formatting ─────────────────────────────────────────────────────

/**
 * Format a Date as ISO 8601 with the port's UTC offset, e.g.
 * "2026-07-28T14:30:00+07:00". This is unambiguous and compatible with
 * common spreadsheet software.
 *
 * Uses Intl.DateTimeFormat to determine the UTC offset in the given IANA
 * timezone at the given instant (DST-aware).
 */
export function formatIsoWithOffset(date: Date, timezone: string): string {
  try {
    // Extract local date/time components
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    let hour = get("hour");
    // Intl can return "24" for midnight in some locales
    if (hour === "24") hour = "00";

    const localStr = `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;

    // Compute UTC offset by comparing local-as-UTC with actual UTC
    const localAsUtc = new Date(`${localStr}Z`);
    const offsetMs = localAsUtc.getTime() - date.getTime();
    const offsetMinutes = Math.round(offsetMs / 60000);
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMin = Math.abs(offsetMinutes);
    const oh = String(Math.floor(absMin / 60)).padStart(2, "0");
    const om = String(absMin % 60).padStart(2, "0");

    return `${localStr}${sign}${oh}:${om}`;
  } catch {
    // Fallback to UTC ISO string if timezone is invalid
    return date.toISOString();
  }
}

// ─── Conflict detection ───────────────────────────────────────────────────────

/**
 * Build a Set of schedule IDs that have at least one conflict, across all
 * berth groups. Uses the existing detectConflicts engine.
 */
export function buildConflictedIds(groups: CsvBerthGroup[]): Set<string> {
  const conflictedIds = new Set<string>();
  for (const group of groups) {
    // detectConflicts expects ValidatedSchedule[]; our CsvBerthGroup schedules
    // carry the same fields that detectConflicts actually reads (id, status,
    // startTime, endTime, positionStart, positionEnd), so the cast is safe.
    const validated = group.schedules as unknown as ValidatedSchedule[];
    const { conflictedIds: ids } = detectConflicts(validated);
    for (const id of ids) conflictedIds.add(id);
  }
  return conflictedIds;
}

// ─── Position-end calculation ─────────────────────────────────────────────────

/**
 * Calculate berthPositionEndMeters = berthPositionMeters + vesselLoa.
 * Returns null when either input is null.
 */
export function calcPositionEnd(
  berthPositionMeters: number | null,
  vesselLoa: number | null,
): number | null {
  if (berthPositionMeters === null || vesselLoa === null) return null;
  return berthPositionMeters + vesselLoa;
}

// ─── Row assembly ─────────────────────────────────────────────────────────────

/**
 * Convert a CsvScheduleRow into an array of RFC 4180-safe field strings,
 * in the same order as CSV_COLUMNS.
 */
export function rowToFields(row: CsvScheduleRow): string[] {
  const tz = row.portTimezone;
  const positionEnd = calcPositionEnd(row.berthPositionMeters, row.vesselLoa);

  return [
    fieldOrEmpty(row.scheduleReference),            // scheduleReference
    safeField(row.vesselCode),                       // vesselCode
    safeField(row.vesselName),                       // vesselName
    fieldOrEmpty(row.voyageNumber),                  // voyageNumber
    fieldOrEmpty(row.serviceCode),                   // serviceCode
    fieldOrEmpty(row.serviceName),                   // serviceName
    safeField(row.terminalName),                     // terminalName
    safeField(row.berthName),                        // berthName
    safeField(tz),                                   // portTimezone
    formatIsoWithOffset(row.eta, tz),                // eta
    row.etb ? formatIsoWithOffset(row.etb, tz) : "", // etb
    formatIsoWithOffset(row.etd, tz),                // etd
    row.berthPositionMeters !== null ? String(row.berthPositionMeters) : "", // berthPositionMeters
    positionEnd !== null ? String(positionEnd) : "",  // berthPositionEndMeters
    row.headingReverse ? "TRUE" : "FALSE",            // headingReverse
    row.vesselLoa !== null ? String(row.vesselLoa) : "", // vesselLoa
    row.status,                                       // status
    row.hasConflict ? "TRUE" : "FALSE",               // hasConflict
    fieldOrEmpty(row.remarks),                        // remarks
    formatIsoWithOffset(row.updatedAt, tz),           // updatedAt
  ];
}

// ─── Sort comparator ──────────────────────────────────────────────────────────

/**
 * Stable sort: effective start time (startTime = etb ?? eta), then berth order,
 * then position start.
 */
export function compareScheduleRows(
  a: { startTime: Date; berthOrder: number; positionStart: number },
  b: { startTime: Date; berthOrder: number; positionStart: number },
): number {
  const timeDiff = a.startTime.getTime() - b.startTime.getTime();
  if (timeDiff !== 0) return timeDiff;
  const berthDiff = a.berthOrder - b.berthOrder;
  if (berthDiff !== 0) return berthDiff;
  return a.positionStart - b.positionStart;
}

// ─── Main export builder ──────────────────────────────────────────────────────

export type BuildCsvOptions = {
  terminalName: string;
  portTimezone: string;
  groups: CsvBerthGroup[];
};

/**
 * Build the full CSV string from berth groups.
 *
 * Steps:
 * 1. Collect all schedules across groups (preserving berth metadata).
 * 2. Compute conflicted IDs using the conflict engine.
 * 3. Sort rows deterministically.
 * 4. Emit header row + data rows as a CRLF-terminated UTF-8 string.
 */
export function buildCsv(options: BuildCsvOptions): string {
  const { terminalName, portTimezone, groups } = options;

  // Build conflict set across all groups
  const conflictedIds = buildConflictedIds(groups);

  // Flatten all schedules with their berth metadata
  type FlatRow = CsvScheduleRow & { startTime: Date; berthOrder: number; positionStart: number };

  const rows: FlatRow[] = [];

  for (const group of groups) {
    for (const s of group.schedules) {
      const hasConflict = conflictedIds.has(s.id);
      rows.push({
        scheduleReference: s.voyageNumber,
        vesselCode: s.vesselCode,
        vesselName: s.vesselName,
        voyageNumber: s.voyageNumber,
        serviceCode: s.serviceCode,
        serviceName: s.serviceName,
        terminalName,
        berthName: group.berthName,
        portTimezone,
        eta: s.eta,
        etb: s.etb,
        etd: s.etd,
        berthPositionMeters: s.berthPositionMeters,
        vesselLoa: s.vesselLoa,
        headingReverse: s.headingReverse,
        status: s.status,
        hasConflict,
        remarks: s.remarks,
        updatedAt: s.updatedAt,
        startTime: s.startTime,
        berthOrder: group.berthOrder,
        positionStart: s.positionStart,
      });
    }
  }

  // Deterministic sort
  rows.sort(compareScheduleRows);

  // Build CSV
  const headerLine = CSV_COLUMNS.join(",");
  const dataLines = rows.map((row) => rowToFields(row).join(","));

  return [headerLine, ...dataLines].join("\r\n") + "\r\n";
}

// ─── Safe filename ────────────────────────────────────────────────────────────

/**
 * Produce a safe ASCII filename for the CSV download.
 * Format: vessel-schedules_<terminal>_<weekStart>_<weekEnd>.csv
 * e.g.: vessel-schedules_Main-Terminal_2026-07-28_2026-08-03.csv
 *
 * weekEnd is the exclusive bound (next Monday), so we subtract one day to get
 * the last day of the visible week (Sunday).
 */
export function buildCsvFilename(
  terminalName: string,
  weekStart: Date,
  weekEnd: Date,
  timezone: string,
): string {
  const safeName = terminalName
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50) || "terminal";

  const startLabel = formatDateOnly(weekStart, timezone);
  // weekEnd is exclusive, so the visible end is one day before
  const sunday = new Date(weekEnd.getTime() - 1000);
  const endLabel = formatDateOnly(sunday, timezone);

  return `vessel-schedules_${safeName}_${startLabel}_${endLabel}.csv`;
}

function formatDateOnly(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

// ─── Export limits ────────────────────────────────────────────────────────────

/** Maximum CSV export date range in days. */
export const CSV_MAX_RANGE_DAYS = 31;

/** Maximum number of schedule rows in a single CSV export. */
export const CSV_MAX_RECORDS = 5000;
