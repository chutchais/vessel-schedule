export const PLANNER_LAYOUT_PREFERENCE_KEY = "berth-planner-controls-collapsed";

export function isCompactPlannerLandscape(width: number, height: number) {
  return width >= 768 && width >= height && height <= 850;
}

export function readControlsCollapsed(storage: Storage | null) {
  return storage?.getItem(PLANNER_LAYOUT_PREFERENCE_KEY) === "true";
}

export function writeControlsCollapsed(storage: Storage | null, collapsed: boolean) {
  storage?.setItem(PLANNER_LAYOUT_PREFERENCE_KEY, String(collapsed));
}
