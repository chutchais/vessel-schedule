"use client";

import { formatDateTime } from "@/lib/berth-planner/timezone";
import type { ConflictGroup, ConflictItem } from "@/lib/berth-planner/conflict-panel";

type ConflictPanelProps = {
  groups: ConflictGroup[];
  selectedConflictId: string | null;
  onSelectConflict: (conflict: ConflictItem) => void;
  onlyConflicts: boolean;
  onToggleOnlyConflicts: () => void;
  portTimezone: string;
  isLoading?: boolean;
};

export function ConflictPanel({
  groups,
  selectedConflictId,
  onSelectConflict,
  onlyConflicts,
  onToggleOnlyConflicts,
  portTimezone,
  isLoading,
}: ConflictPanelProps) {
  const allConflicts = groups.flatMap((g) => g.conflicts);
  const totalCount = allConflicts.length;
  const selectedIndex = allConflicts.findIndex((c) => c.id === selectedConflictId);

  function handlePrev() {
    if (totalCount === 0) return;
    const prev = selectedIndex <= 0 ? totalCount - 1 : selectedIndex - 1;
    onSelectConflict(allConflicts[prev]!);
  }

  function handleNext() {
    if (totalCount === 0) return;
    const next = selectedIndex >= totalCount - 1 ? 0 : selectedIndex + 1;
    onSelectConflict(allConflicts[next]!);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2">
        <span className="text-sm font-semibold text-slate-800">
          Conflicts
          {totalCount > 0 && (
            <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
              {totalCount}
            </span>
          )}
        </span>

        <label className="ml-4 flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 select-none">
          <input
            type="checkbox"
            checked={onlyConflicts}
            onChange={onToggleOnlyConflicts}
            className="rounded border-slate-300 accent-blue-600"
          />
          Only conflicts
        </label>

        {/* Prev / Next navigation — shown only when there are conflicts */}
        {totalCount > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Previous conflict"
            >
              ‹ Prev
            </button>
            <span className="text-xs text-slate-400">
              {selectedIndex >= 0 ? `${selectedIndex + 1} / ${totalCount}` : `${totalCount}`}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Next conflict"
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="px-4 py-4">
          <p className="text-sm text-slate-500">Checking for conflicts…</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="px-4 py-4">
          <p className="text-sm text-slate-500">No conflicts in this terminal and week. ✓</p>
        </div>
      ) : (
        <ul className="max-h-48 overflow-y-auto" role="list" aria-label="Berth conflicts">
          {groups.map((group) => (
            <li key={group.berthId}>
              <div className="sticky top-0 bg-slate-50 px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.berthName}
              </div>
              <ul role="list">
                {group.conflicts.map((conflict) => {
                  const isSelected = conflict.id === selectedConflictId;
                  return (
                    <li key={conflict.id}>
                      <button
                        type="button"
                        onClick={() => onSelectConflict(conflict)}
                        className={`w-full border-b border-slate-100 px-4 py-2 text-left text-xs transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400 ${
                          isSelected ? "bg-red-50 ring-1 ring-inset ring-red-300" : ""
                        }`}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0 text-red-500" aria-hidden>
                            ⚠
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-800">
                              {conflict.vesselAName}
                              {conflict.voyageANumber ? (
                                <span className="font-normal text-slate-500">
                                  {" "}
                                  ({conflict.voyageANumber})
                                </span>
                              ) : null}
                              {" vs "}
                              {conflict.vesselBName}
                              {conflict.voyageBNumber ? (
                                <span className="font-normal text-slate-500">
                                  {" "}
                                  ({conflict.voyageBNumber})
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-slate-500">
                              <span className="font-medium text-slate-600">Time: </span>
                              {formatDateTime(conflict.overlapStart, portTimezone)}
                              {" – "}
                              {formatDateTime(conflict.overlapEnd, portTimezone)}
                            </p>
                            <p className="text-slate-500">
                              <span className="font-medium text-slate-600">Position: </span>
                              {conflict.overlapPositionStart.toFixed(0)}–
                              {conflict.overlapPositionEnd.toFixed(0)} m
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
