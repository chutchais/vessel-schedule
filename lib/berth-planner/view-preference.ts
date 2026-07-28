import type { PlannerDomain } from "./types";

export const BERTH_PLANNER_VIEW_STORAGE_KEY = "berth-planner:view-domain";

export function normalizePlannerDomain(value: string | null | undefined): PlannerDomain {
  return value === "datetime" ? "datetime" : "position";
}

export function readPreferredPlannerDomain(storage: Pick<Storage, "getItem"> | null): PlannerDomain {
  if (!storage) return "position";
  return normalizePlannerDomain(storage.getItem(BERTH_PLANNER_VIEW_STORAGE_KEY));
}

export function writePreferredPlannerDomain(
  storage: Pick<Storage, "setItem"> | null,
  domain: PlannerDomain,
): void {
  if (!storage) return;
  storage.setItem(BERTH_PLANNER_VIEW_STORAGE_KEY, domain);
}

export type PlannerViewSnapshot = {
  domain: PlannerDomain;
  selectedTerminalId: string;
  weekStartIso: string;
  activeScheduleId: string | null;
};

export function switchPlannerDomainPreservingState(
  snapshot: PlannerViewSnapshot,
  domain: PlannerDomain,
): PlannerViewSnapshot {
  return { ...snapshot, domain };
}
