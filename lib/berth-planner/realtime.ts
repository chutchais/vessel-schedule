export type PlannerChangeAction = "created" | "edited" | "moved" | "resized" | "undone" | "deleted";

export type PlannerChangeEvent = {
  id: string;
  scheduleId: string;
  action: PlannerChangeAction;
  createdAt: string;
  vesselName: string;
  voyageNumber: string | null;
  actorName: string;
  isCurrentUser: boolean;
  changedFields: string[];
  terminalId: string | null;
  eta: string | null;
  etd: string | null;
  isVisibleInWeek: boolean;
};

export type PlannerChangesResponse = {
  data: PlannerChangeEvent[];
  cursor: string | null;
  hasMore: boolean;
};

export type ChangeHighlight = {
  tone: "created" | "updated" | "conflict";
  stronger: boolean;
};

export function actionFromAudit(input: { action: string; metadata: unknown }): PlannerChangeAction | null {
  if (input.action === "CREATE") return "created";
  if (input.action === "DELETE") return "deleted";
  if (input.action !== "UPDATE") return null;
  const context = isRecord(input.metadata) && typeof input.metadata.context === "string"
    ? input.metadata.context
    : "";
  if (context === "Berth Planner move") return "moved";
  if (context === "Berth Planner resize") return "resized";
  if (context === "Berth Planner undo") return "undone";
  return "edited";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getChangedFields(beforeData: unknown, afterData: unknown): string[] {
  const before = isRecord(beforeData) ? beforeData : {};
  const after = isRecord(afterData) ? afterData : {};
  const fields = ["vesselId", "serviceId", "voyageNumber", "terminalId", "berthId", "eta", "etb", "etd", "status", "berthPositionMeters", "headingReverse"];
  return fields.filter((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null));
}

export function scheduleSnapshotForEvent(beforeData: unknown, afterData: unknown): Record<string, unknown> {
  return isRecord(afterData) ? afterData : isRecord(beforeData) ? beforeData : {};
}

export function intersectsWeek(snapshot: Record<string, unknown>, terminalId: string, start: Date, end: Date): boolean {
  if (snapshot.terminalId !== terminalId) return false;
  const eta = typeof snapshot.eta === "string" ? new Date(snapshot.eta) : null;
  const etd = typeof snapshot.etd === "string" ? new Date(snapshot.etd) : null;
  return Boolean(eta && etd && !Number.isNaN(eta.getTime()) && !Number.isNaN(etd.getTime()) && eta < end && etd > start);
}

export function eventIsRelevant(input: { beforeData: unknown; afterData: unknown; terminalId: string; start: Date; end: Date }): boolean {
  return intersectsWeek(scheduleSnapshotForEvent(input.beforeData, {}), input.terminalId, input.start, input.end)
    || intersectsWeek(scheduleSnapshotForEvent({}, input.afterData), input.terminalId, input.start, input.end);
}

export function highlightForChange(event: PlannerChangeEvent, hasConflict: boolean): ChangeHighlight {
  return {
    tone: hasConflict ? "conflict" : event.action === "created" ? "created" : "updated",
    stronger: !event.isCurrentUser,
  };
}

export function canFocusChange(input: { event: PlannerChangeEvent; visibleScheduleIds: Set<string> }): string | null {
  if (input.event.action === "deleted") return "This schedule was deleted and can no longer be focused.";
  if (!input.event.isVisibleInWeek) return "This schedule is now outside the visible week.";
  if (!input.visibleScheduleIds.has(input.event.scheduleId)) return "This schedule is hidden by the active filters.";
  return null;
}
