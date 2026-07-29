"use client";

import { useEffect } from "react";
import { formatDateTime } from "@/lib/berth-planner/timezone";

export type DragConfirmDialogProps = {
  isOpen: boolean;
  vesselName: string;
  oldBerthName: string;
  oldPositionStart: number;
  oldStartTime: Date;
  oldEndTime: Date;
  newBerthName: string;
  newPositionStart: number;
  newStartTime: Date;
  newEndTime: Date;
  portTimezone: string;
  isSaving: boolean;
  saveError: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DragConfirmDialog({
  isOpen,
  vesselName,
  oldBerthName,
  oldPositionStart,
  oldStartTime,
  oldEndTime,
  newBerthName,
  newPositionStart,
  newStartTime,
  newEndTime,
  portTimezone,
  isSaving,
  saveError,
  onConfirm,
  onCancel,
}: DragConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isSaving, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="drag-confirm-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="drag-confirm-title" className="text-base font-semibold text-slate-900">Confirm Vessel Move</h2>
          <p className="mt-0.5 text-sm text-slate-500">{vesselName}</p>
        </div>

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Current location
            </p>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="inline text-slate-500">Berth: </dt>
                <dd className="inline font-medium text-slate-800">{oldBerthName}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Position: </dt>
                <dd className="inline font-medium text-slate-800">{oldPositionStart} m</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">ETB/ETA: </dt>
                <dd className="inline font-medium text-slate-800">
                  {formatDateTime(oldStartTime, portTimezone)}
                </dd>
              </div>
              <div>
                <dt className="inline text-slate-500">ETD: </dt>
                <dd className="inline font-medium text-slate-800">
                  {formatDateTime(oldEndTime, portTimezone)}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-blue-500">
              New location
            </p>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="inline text-slate-500">Berth: </dt>
                <dd className="inline font-medium text-blue-700">{newBerthName}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Position: </dt>
                <dd className="inline font-medium text-blue-700">{newPositionStart} m</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">ETB/ETA: </dt>
                <dd className="inline font-medium text-blue-700">
                  {formatDateTime(newStartTime, portTimezone)}
                </dd>
              </div>
              <div>
                <dt className="inline text-slate-500">ETD: </dt>
                <dd className="inline font-medium text-blue-700">
                  {formatDateTime(newEndTime, portTimezone)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {saveError && (
          <div className="mx-5 mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="min-h-11 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Confirm Move"}
          </button>
        </div>
      </div>
    </div>
  );
}
