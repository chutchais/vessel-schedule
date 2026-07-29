export type PlannerPerformanceEntry = {
  name: string;
  durationMs: number;
  detail?: Record<string, number | string | boolean>;
  memoryBytes?: number;
  at: string;
};

declare global {
  interface Window {
    __berthPlannerPerformance?: PlannerPerformanceEntry[];
  }
}

function enabled() {
  return process.env.NODE_ENV !== "production" && typeof window !== "undefined" && typeof performance !== "undefined";
}

/** Development-only, bounded timing buffer for manual benchmark collection. */
export function recordPlannerPerformance(name: string, startedAt: number, detail?: PlannerPerformanceEntry["detail"]) {
  if (!enabled()) return;
  const durationMs = performance.now() - startedAt;
  const memory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
  const entry: PlannerPerformanceEntry = { name, durationMs, detail, memoryBytes: memory.memory?.usedJSHeapSize, at: new Date().toISOString() };
  const records = window.__berthPlannerPerformance ?? [];
  records.push(entry);
  window.__berthPlannerPerformance = records.slice(-200);
  window.dispatchEvent(new CustomEvent("berth-planner-performance", { detail: entry }));
}

export function startPlannerPerformance() {
  return performance.now();
}
