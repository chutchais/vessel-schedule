export const BERTH_PLANNER_LABEL_SCALE_STORAGE_KEY = "berth-planner-label-scale-v1";
export const BERTH_PLANNER_LABEL_SCALE_STEPS = [80, 90, 100, 110, 125, 140] as const;

export type BerthPlannerLabelScale = (typeof BERTH_PLANNER_LABEL_SCALE_STEPS)[number];

export function normalizeBerthPlannerLabelScale(value: unknown): BerthPlannerLabelScale {
  if (typeof value === "number" && BERTH_PLANNER_LABEL_SCALE_STEPS.includes(value as BerthPlannerLabelScale)) {
    return value as BerthPlannerLabelScale;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (BERTH_PLANNER_LABEL_SCALE_STEPS.includes(parsed as BerthPlannerLabelScale)) {
      return parsed as BerthPlannerLabelScale;
    }
  }
  return 100;
}

export function readBerthPlannerLabelScale(storage: Pick<Storage, "getItem"> | null): BerthPlannerLabelScale {
  if (!storage) return 100;
  return normalizeBerthPlannerLabelScale(storage.getItem(BERTH_PLANNER_LABEL_SCALE_STORAGE_KEY));
}

export function writeBerthPlannerLabelScale(
  storage: Pick<Storage, "setItem"> | null,
  scale: BerthPlannerLabelScale,
): void {
  if (!storage) return;
  storage.setItem(BERTH_PLANNER_LABEL_SCALE_STORAGE_KEY, String(scale));
}

export function shiftBerthPlannerLabelScale(
  current: BerthPlannerLabelScale,
  direction: -1 | 1,
): BerthPlannerLabelScale {
  const index = BERTH_PLANNER_LABEL_SCALE_STEPS.indexOf(current);
  const safeIndex = index === -1 ? BERTH_PLANNER_LABEL_SCALE_STEPS.indexOf(100) : index;
  const nextIndex = Math.max(0, Math.min(BERTH_PLANNER_LABEL_SCALE_STEPS.length - 1, safeIndex + direction));
  return BERTH_PLANNER_LABEL_SCALE_STEPS[nextIndex]!;
}

export function canDecreaseBerthPlannerLabelScale(scale: BerthPlannerLabelScale): boolean {
  return scale > BERTH_PLANNER_LABEL_SCALE_STEPS[0];
}

export function canIncreaseBerthPlannerLabelScale(scale: BerthPlannerLabelScale): boolean {
  return scale < BERTH_PLANNER_LABEL_SCALE_STEPS[BERTH_PLANNER_LABEL_SCALE_STEPS.length - 1];
}
