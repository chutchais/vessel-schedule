/**
 * Export-table configuration for the Berth Planner print/PDF export.
 *
 * Each organization can configure which columns appear in the vessel-details
 * table that follows the planner-grid pages. The table is rendered as a canvas
 * page and appended to the existing weekly-export output.
 *
 * Reuses the shared placeholder registry from vessel-label.ts.
 * Column values are resolved with the same replaceToken logic.
 */

import {
  VESSEL_LABEL_PLACEHOLDER_GROUPS,
  resolveVesselLabelLines,
} from "./vessel-label";
import type { VesselLabelTemplateContext } from "./vessel-label";

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ExportColumnWidth = "AUTO" | "COMPACT" | "NORMAL" | "WIDE";
export type ExportColumnAlign = "AUTO" | "LEFT" | "CENTER" | "RIGHT";

const COLUMN_WIDTHS: ExportColumnWidth[] = ["AUTO", "COMPACT", "NORMAL", "WIDE"];
const COLUMN_ALIGNS: ExportColumnAlign[] = ["AUTO", "LEFT", "CENTER", "RIGHT"];

// ─── Config types ─────────────────────────────────────────────────────────────

export type ExportTableColumn = {
  /** Unique stable column identifier matching the placeholder key (without braces) or "position". */
  id: string;
  /** Placeholder template, e.g. "{{vesselName}}" or the special "{{position}}" composite. */
  placeholder: string;
  /** User-facing column heading. */
  heading: string;
  visible: boolean;
  order: number;
  width: ExportColumnWidth;
  align: ExportColumnAlign;
};

export type ExportTableConfig = {
  version: 1;
  includeTable: boolean;
  columns: ExportTableColumn[];
};

// ─── Allowed placeholders ─────────────────────────────────────────────────────

/** All token keys that may appear in export column placeholders (without braces). */
const ALLOWED_PLACEHOLDER_TOKENS = new Set<string>([
  // Gathered from VESSEL_LABEL_PLACEHOLDER_GROUPS
  ...VESSEL_LABEL_PLACEHOLDER_GROUPS.flatMap((g) => g.placeholders.map((p) => p.key.replace(/\{\{|\}\}/g, ""))),
  // Composite column
  "position",
]);

// ─── Default configuration ────────────────────────────────────────────────────

export const DEFAULT_EXPORT_TABLE_COLUMNS: ExportTableColumn[] = [
  { id: "vesselName",   placeholder: "{{vesselName}}",   heading: "Vessel",    visible: true,  order: 1,  width: "NORMAL",  align: "LEFT"   },
  { id: "voyageNumber", placeholder: "{{voyageNumber}}", heading: "Voyage",    visible: true,  order: 2,  width: "COMPACT", align: "LEFT"   },
  { id: "serviceName",  placeholder: "{{serviceName}}",  heading: "Service",   visible: true,  order: 3,  width: "NORMAL",  align: "LEFT"   },
  { id: "berthName",    placeholder: "{{berthName}}",    heading: "Berth",     visible: true,  order: 4,  width: "COMPACT", align: "LEFT"   },
  { id: "position",     placeholder: "{{position}}",     heading: "Position",  visible: true,  order: 5,  width: "COMPACT", align: "RIGHT"  },
  { id: "eta",          placeholder: "{{eta}}",          heading: "ETA",       visible: true,  order: 6,  width: "COMPACT", align: "CENTER" },
  { id: "etb",          placeholder: "{{etb}}",          heading: "ETB",       visible: true,  order: 7,  width: "COMPACT", align: "CENTER" },
  { id: "etd",          placeholder: "{{etd}}",          heading: "ETD",       visible: true,  order: 8,  width: "COMPACT", align: "CENTER" },
  { id: "status",       placeholder: "{{status}}",       heading: "Status",    visible: true,  order: 9,  width: "COMPACT", align: "CENTER" },
  { id: "remarks",      placeholder: "{{remarks}}",      heading: "Remarks",   visible: true,  order: 10, width: "WIDE",    align: "LEFT"   },
];

export const DEFAULT_EXPORT_TABLE_CONFIG: ExportTableConfig = {
  version: 1,
  includeTable: true,
  columns: DEFAULT_EXPORT_TABLE_COLUMNS,
};

export function defaultExportTableConfig(): ExportTableConfig {
  return {
    version: 1,
    includeTable: true,
    columns: DEFAULT_EXPORT_TABLE_COLUMNS.map((col) => ({ ...col })),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function extractToken(placeholder: string): string {
  const m = /^\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}$/.exec(placeholder);
  return m ? m[1]! : "";
}

// ─── Validation (server-side) ─────────────────────────────────────────────────

export function validateExportTableConfigInput(raw: unknown):
  | { ok: true; config: ExportTableConfig }
  | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "Export table configuration must be an object." };

  if (typeof raw.includeTable !== "boolean") {
    return { ok: false, error: "includeTable must be a boolean." };
  }

  if (!Array.isArray(raw.columns)) {
    return { ok: false, error: "columns must be an array." };
  }

  if (raw.columns.length === 0) {
    return { ok: false, error: "At least one column is required." };
  }

  if (raw.columns.length > 20) {
    return { ok: false, error: "A maximum of 20 columns is allowed." };
  }

  const seenIds = new Set<string>();
  const columns: ExportTableColumn[] = [];

  for (let i = 0; i < raw.columns.length; i++) {
    const col = raw.columns[i];
    if (!isRecord(col)) return { ok: false, error: `Column ${i + 1} must be an object.` };

    if (typeof col.id !== "string" || !col.id.trim()) {
      return { ok: false, error: `Column ${i + 1} id is required.` };
    }
    const id = col.id.trim();

    if (seenIds.has(id)) {
      return { ok: false, error: `Duplicate column id "${id}".` };
    }
    seenIds.add(id);

    if (typeof col.placeholder !== "string") {
      return { ok: false, error: `Column ${i + 1} placeholder is required.` };
    }
    const placeholder = col.placeholder.trim();

    // Validate placeholder: must be {{token}} form with an allowed token
    const token = extractToken(placeholder);
    if (!token || !ALLOWED_PLACEHOLDER_TOKENS.has(token)) {
      return { ok: false, error: `Column ${i + 1} uses an unknown or unsupported placeholder "${placeholder}".` };
    }

    if (typeof col.heading !== "string" || !col.heading.trim()) {
      return { ok: false, error: `Column ${i + 1} heading is required.` };
    }
    if (col.heading.trim().length > 60) {
      return { ok: false, error: `Column ${i + 1} heading is too long.` };
    }

    if (typeof col.visible !== "boolean") {
      return { ok: false, error: `Column ${i + 1} visible must be a boolean.` };
    }

    if (typeof col.order !== "number" || !Number.isFinite(col.order)) {
      return { ok: false, error: `Column ${i + 1} order must be a number.` };
    }

    if (!isEnumValue(col.width, COLUMN_WIDTHS)) {
      return { ok: false, error: `Column ${i + 1} has invalid width "${String(col.width)}".` };
    }

    if (!isEnumValue(col.align, COLUMN_ALIGNS)) {
      return { ok: false, error: `Column ${i + 1} has invalid align "${String(col.align)}".` };
    }

    columns.push({
      id,
      placeholder,
      heading: col.heading.trim(),
      visible: col.visible,
      order: col.order,
      width: col.width,
      align: col.align,
    });
  }

  // Require at least one visible identifying column (vesselName or berthName)
  const visibleIds = columns.filter((c) => c.visible).map((c) => c.id);
  if (visibleIds.length === 0) {
    return { ok: false, error: "At least one column must be visible." };
  }

  return { ok: true, config: { version: 1, includeTable: raw.includeTable, columns } };
}

export function normalizeStoredExportTableConfig(raw: unknown): ExportTableConfig {
  if (!isRecord(raw)) return defaultExportTableConfig();
  const result = validateExportTableConfigInput(raw);
  if (result.ok) return result.config;
  return defaultExportTableConfig();
}

// ─── Value resolution ─────────────────────────────────────────────────────────

const EMPTY_MARKER = "—";

/**
 * Resolve a single export-column value for a given schedule context.
 * Reuses the same formatting/calculation rules as vessel labels.
 */
export function resolveExportColumnValue(
  placeholder: string,
  context: VesselLabelTemplateContext & { berthName: string },
): string {
  const token = extractToken(placeholder);
  if (!token) return EMPTY_MARKER;

  // Composite position column
  if (token === "position") {
    const start = context.berthPositionStart;
    const end = context.berthPositionEnd;
    if (typeof start === "number" && typeof end === "number") {
      return `${start}–${end} m`;
    }
    return EMPTY_MARKER;
  }

  // All other tokens resolved by the shared replaceToken logic.
  // Delegates to resolveVesselLabelLines with a single-token template.
  const lines = resolveVesselLabelLines(
    { schemaVersion: 1, lines: [{ template: placeholder, fontWeight: "REGULAR", fontSize: "AUTO", textAlign: "LEFT", textColor: "AUTO" }] },
    context,
  );
  const value = lines[0]?.text ?? "";
  return value.trim() || EMPTY_MARKER;
}

// ─── Export row type ──────────────────────────────────────────────────────────

export type ExportTableRow = {
  cells: string[];
};

export type ExportTableData = {
  visibleColumns: ExportTableColumn[];
  rows: ExportTableRow[];
};

/**
 * Build the sorted table data from the visible berths+schedules, using port
 * timezone for time formatting. Only schedules with valid placement are
 * included. Sorted by: ETA asc → berth order → positionStart.
 */
export function buildExportTableData(
  berths: Array<{
    id: string;
    name: string;
    berthLength: number;
    zeroOriginSide: "LEFT" | "RIGHT";
    order: number;
    schedules: Array<{
      id: string;
      vesselName: string;
      vesselLoa: number | null;
      serviceName: string | null;
      serviceColor: string | null;
      voyageNumber: string | null;
      status: string;
      startTime: Date;
      endTime: Date;
      etb: Date | null;
      positionStart: number;
      positionEnd: number;
      headingReverse: boolean;
      remarks?: string | null;
      updatedAt?: string;
    }>;
  }>,
  config: ExportTableConfig,
  timezone: string,
): ExportTableData {
  const visibleColumns = config.columns
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  if (!config.includeTable || visibleColumns.length === 0) {
    return { visibleColumns: [], rows: [] };
  }

  // Collect all schedule rows across berths with berth context attached
  const items: Array<{
    berthOrder: number;
    berthName: string;
    berthLength: number;
    zeroOriginSide: "LEFT" | "RIGHT";
    schedule: (typeof berths)[0]["schedules"][0];
  }> = [];

  for (const berth of berths) {
    for (const schedule of berth.schedules) {
      items.push({
        berthOrder: berth.order,
        berthName: berth.name,
        berthLength: berth.berthLength,
        zeroOriginSide: berth.zeroOriginSide,
        schedule,
      });
    }
  }

  // Sort: ETA asc → berth order → positionStart
  items.sort((a, b) => {
    const timeDiff = a.schedule.startTime.getTime() - b.schedule.startTime.getTime();
    if (timeDiff !== 0) return timeDiff;
    const berthDiff = a.berthOrder - b.berthOrder;
    if (berthDiff !== 0) return berthDiff;
    return a.schedule.positionStart - b.schedule.positionStart;
  });

  const rows: ExportTableRow[] = items.map(({ berthName, berthLength, zeroOriginSide, schedule }) => {
    const context: VesselLabelTemplateContext & { berthName: string } = {
      vesselName: schedule.vesselName,
      vesselLoa: schedule.vesselLoa,
      serviceName: schedule.serviceName,
      serviceColor: schedule.serviceColor,
      voyageNumber: schedule.voyageNumber,
      berthName,
      berthLength,
      berthZeroOriginSide: zeroOriginSide,
      scheduleStatus: schedule.status,
      berthPositionStart: schedule.positionStart,
      berthPositionEnd: schedule.positionEnd,
      headingReverse: schedule.headingReverse,
      remarks: schedule.remarks ?? null,
      eta: schedule.startTime,
      etb: schedule.etb,
      etd: schedule.endTime,
      updatedAt: schedule.updatedAt,
      timezone,
    };
    const cells = visibleColumns.map((col) => resolveExportColumnValue(col.placeholder, context));
    return { cells };
  });

  return { visibleColumns, rows };
}

// ─── Column width helpers for canvas rendering ────────────────────────────────

export function columnWidthFraction(width: ExportColumnWidth): number {
  switch (width) {
    case "COMPACT": return 0.7;
    case "WIDE":    return 1.8;
    case "NORMAL":  return 1.0;
    default:        return 1.0; // AUTO
  }
}

export function columnTextAlign(align: ExportColumnAlign): "left" | "center" | "right" {
  if (align === "LEFT") return "left";
  if (align === "CENTER") return "center";
  if (align === "RIGHT") return "right";
  return "left"; // AUTO default
}

// ─── P2022 guard ──────────────────────────────────────────────────────────────

export function isMissingExportTableConfigColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown; message?: unknown };
  return (
    maybe.code === "P2022" &&
    typeof maybe.message === "string" &&
    maybe.message.includes("organizations.exportTableConfig")
  );
}
