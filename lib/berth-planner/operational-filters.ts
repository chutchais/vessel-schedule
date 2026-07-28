import { classifySchedules } from "./layout";
import type {
  PlannerBerth,
  PlannerDomain,
  PlannerSchedule,
  ScheduleStatus,
} from "./types";

export const SCHEDULE_STATUSES: ScheduleStatus[] = [
  "PLANNED",
  "CONFIRMED",
  "ARRIVED",
  "BERTHED",
  "DEPARTED",
  "CANCELLED",
];

export type OperationalFilters = {
  search: string;
  service: string;
  status: ScheduleStatus | "";
  berthId: string;
  conflictsOnly: boolean;
  invalidOnly: boolean;
};

export const EMPTY_OPERATIONAL_FILTERS: OperationalFilters = {
  search: "",
  service: "",
  status: "",
  berthId: "",
  conflictsOnly: false,
  invalidOnly: false,
};

export type PlannerUrlState = {
  terminalId: string;
  week: string;
  domain: PlannerDomain;
  filters: OperationalFilters;
};

export function parseBooleanParam(value: string | null): boolean {
  return value === "1";
}

export function isIsoDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parsePlannerUrlState(params: URLSearchParams): PlannerUrlState {
  const statusValue = params.get("status");
  const status = SCHEDULE_STATUSES.includes(statusValue as ScheduleStatus)
    ? statusValue as ScheduleStatus
    : "";
  const domain = params.get("view") === "datetime" ? "datetime" : "position";

  return {
    terminalId: params.get("terminal")?.trim() ?? "",
    week: isIsoDateOnly(params.get("week")) ? params.get("week")! : "",
    domain,
    filters: {
      search: (params.get("q") ?? "").trim().slice(0, 100),
      service: (params.get("service") ?? "").trim().slice(0, 100),
      status,
      berthId: (params.get("berth") ?? "").trim().slice(0, 100),
      conflictsOnly: parseBooleanParam(params.get("conflicts")),
      invalidOnly: parseBooleanParam(params.get("invalid")),
    },
  };
}

export function serializePlannerUrlState(state: PlannerUrlState): string {
  const params = new URLSearchParams();
  if (state.terminalId) params.set("terminal", state.terminalId);
  if (state.week) params.set("week", state.week);
  if (state.domain !== "position") params.set("view", state.domain);
  if (state.filters.search) params.set("q", state.filters.search);
  if (state.filters.service) params.set("service", state.filters.service);
  if (state.filters.status) params.set("status", state.filters.status);
  if (state.filters.berthId) params.set("berth", state.filters.berthId);
  if (state.filters.conflictsOnly) params.set("conflicts", "1");
  if (state.filters.invalidOnly) params.set("invalid", "1");
  return params.toString();
}

export function hasActiveFilters(filters: OperationalFilters): boolean {
  return Boolean(
    filters.search ||
    filters.service ||
    filters.status ||
    filters.berthId ||
    filters.conflictsOnly ||
    filters.invalidOnly,
  );
}

export function scheduleMatchesSearch(schedule: PlannerSchedule, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return [schedule.vesselName, schedule.voyageNumber ?? "", schedule.id]
    .some((value) => value.toLocaleLowerCase().includes(query));
}

export function filterPlannerBerths(args: {
  berths: PlannerBerth[];
  filters: OperationalFilters;
  conflictedScheduleIds: Set<string>;
}): PlannerBerth[] {
  const { berths, filters, conflictedScheduleIds } = args;

  return berths.map((berth) => {
    const invalidIds = new Set(
      classifySchedules(berth.schedules, berth.berthLength).invalid.map((record) => record.scheduleId),
    );
    const schedules = berth.schedules.filter((schedule) => {
      if (!scheduleMatchesSearch(schedule, filters.search)) return false;
      if (filters.service && schedule.serviceName !== filters.service) return false;
      if (filters.status && schedule.status !== filters.status) return false;
      if (filters.berthId && schedule.berthId !== filters.berthId) return false;
      if (filters.conflictsOnly && !conflictedScheduleIds.has(schedule.id)) return false;
      if (filters.invalidOnly && !invalidIds.has(schedule.id)) return false;
      return true;
    });
    return { ...berth, schedules };
  });
}

export function countSchedules(berths: PlannerBerth[]): number {
  return berths.reduce((total, berth) => total + berth.schedules.length, 0);
}

export function shouldClearHiddenSelection(
  selectedScheduleId: string | null,
  visibleScheduleIds: Set<string>,
): boolean {
  return selectedScheduleId !== null && !visibleScheduleIds.has(selectedScheduleId);
}
