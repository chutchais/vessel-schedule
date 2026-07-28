"use client";

import { formatDateTime } from "@/lib/berth-planner/timezone";
import { canFocusChange, type PlannerChangeEvent } from "@/lib/berth-planner/realtime";
import { buildAuditHistoryUrl } from "@/lib/audit/history-url";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";

type Props = {
  changes: PlannerChangeEvent[];
  loading: boolean;
  error: string | null;
  portTimezone: string;
  visibleScheduleIds: Set<string>;
  onFocus: (scheduleId: string) => void;
  onNotice: (message: string) => void;
};

const ACTION_LABELS: Record<PlannerChangeEvent["action"], string> = {
  created: "Created",
  edited: "Edited",
  moved: "Moved",
  resized: "Resized",
  undone: "Undone",
  deleted: "Deleted",
};

export function RecentChangesPanel({ changes, loading, error, portTimezone, visibleScheduleIds, onFocus, onNotice }: Props) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 sm:p-4" aria-labelledby="recent-changes-title">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="recent-changes-title" className="text-sm font-semibold text-slate-800">Recent Changes</h2>
        <span className="text-xs text-slate-500">Latest {Math.min(changes.length, 50)}</span>
      </div>
      {loading ? <p className="py-4 text-sm text-slate-500">Loading recent changes…</p> : null}
      {error ? <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {!loading && !error && changes.length === 0 ? <p className="py-4 text-sm text-slate-500">No schedule changes for this terminal and week yet.</p> : null}
      {changes.length > 0 ? (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {changes.map((change) => (
            <li key={change.id} className="rounded-md border border-slate-100 p-2 text-xs text-slate-600">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 text-left font-medium text-slate-800 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => {
                    const reason = canFocusChange({ event: change, visibleScheduleIds });
                    if (reason) onNotice(reason);
                    else onFocus(change.scheduleId);
                  }}
                >
                  {change.vesselName}{change.voyageNumber ? ` · ${change.voyageNumber}` : ""}
                </button>
                <a className="shrink-0 text-blue-700 hover:underline" href={buildAuditHistoryUrl(AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE, change.scheduleId)}>History</a>
              </div>
              <p className="mt-1"><span className="font-medium">{ACTION_LABELS[change.action]}</span> by {change.actorName}{!change.isCurrentUser ? " · another user" : ""}</p>
              <p className="mt-1 text-slate-500">{formatDateTime(new Date(change.createdAt), portTimezone)}{change.changedFields.length ? ` · ${change.changedFields.join(", ")}` : ""}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
