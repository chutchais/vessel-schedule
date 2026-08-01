import type { VesselLabelConfig } from "./vessel-label";
import type { ExportTableConfig } from "./export-table-config";

export type PlannerDomain = "position" | "datetime";

export type ScheduleStatus =
  | "PLANNED"
  | "CONFIRMED"
  | "ARRIVED"
  | "BERTHED"
  | "DEPARTED"
  | "CANCELLED";

export type ZeroOriginSide = "LEFT" | "RIGHT";

/** A schedule as returned by the planner API. All dates are ISO strings. */
export type PlannerScheduleRaw = {
  id: string;
  vesselName: string;
  /** Vessel LOA in metres. Null means the field is not set in the database. */
  vesselLoa: number | null;
  vesselColor: string;
  serviceName: string | null;
  serviceColor: string | null;
  status: ScheduleStatus;
  eta: string;
  etb: string | null;
  etd: string;
  berthPositionMeters: number | null;
  headingReverse: boolean;
  remarks?: string | null;
  berthId: string;
  voyageNumber: string | null;
  updatedAt: string;
};

/** A schedule with parsed Date objects, ready for layout and rendering. */
export type PlannerSchedule = {
  id: string;
  vesselName: string;
  vesselLoa: number | null;
  vesselColor: string;
  serviceName: string | null;
  serviceColor: string | null;
  status: ScheduleStatus;
  eta: Date;
  etb: Date | null;
  etd: Date;
  berthPositionMeters: number | null;
  headingReverse: boolean;
  remarks?: string | null;
  berthId: string;
  voyageNumber: string | null;
  updatedAt?: string;
};

/** A schedule that has passed all geometry validation and can be drawn on canvas. */
export type ValidatedSchedule = PlannerSchedule & {
  startTime: Date;
  endTime: Date;
  positionStart: number;
  positionEnd: number;
};

/** Describes why a schedule could not be placed on the canvas. */
export type InvalidScheduleRecord = {
  scheduleId: string;
  vesselName: string;
  reason: string;
};

export type PlannerBerthRaw = {
  id: string;
  name: string;
  berthLength: number;
  zeroOriginSide: ZeroOriginSide;
  order: number;
  schedules: PlannerScheduleRaw[];
};

export type PlannerDataRaw = {
  organizationName: string;
  terminalId: string;
  terminalName: string;
  portName: string;
  portTimezone: string;
  vesselLabelConfig: VesselLabelConfig;
  exportTableConfig: ExportTableConfig;
  berths: PlannerBerthRaw[];
};

export type PlannerBerth = {
  id: string;
  name: string;
  berthLength: number;
  zeroOriginSide: ZeroOriginSide;
  order: number;
  schedules: PlannerSchedule[];
};

export type PlannerData = {
  terminalId: string;
  terminalName: string;
  portName: string;
  portTimezone: string;
  berths: PlannerBerth[];
};

/** Viewport parameters for the position-domain canvas. */
export type PositionViewport = {
  /** Canvas width in CSS pixels (already multiplied by devicePixelRatio inside canvas). */
  canvasWidth: number;
  /** Canvas height in CSS pixels. */
  canvasHeight: number;
  /** Start of the visible date range. */
  rangeStart: Date;
  /** End of the visible date range. */
  rangeEnd: Date;
  /** Left margin reserved for the time-axis labels. */
  timeAxisWidth: number;
  /** Top margin reserved for header / berth name labels. */
  headerHeight: number;
  /** Height in pixels of each berth row. */
  berthRowHeight: number;
};

export type ConflictPair = {
  scheduleAId: string;
  scheduleBId: string;
};
