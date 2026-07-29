"use client";

import { useEffect } from "react";
import { formatDateTime } from "@/lib/berth-planner/timezone";

function duration(start: Date, end: Date) {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function ResizeConfirmDialog(props: {
  isOpen: boolean;
  vesselName: string;
  oldStartTime: Date;
  oldEndTime: Date;
  newStartTime: Date;
  newEndTime: Date;
  portTimezone: string;
  isSaving: boolean;
  saveError: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { isOpen, isSaving, onCancel } = props;
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isSaving, onCancel]);

  if (!props.isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="resize-confirm-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="resize-confirm-title" className="text-base font-semibold text-slate-900">Confirm Duration Resize</h2>
          <p className="mt-0.5 text-sm text-slate-500">{props.vesselName}</p>
        </div>
        <div className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-2">
          {[
            ["Current", props.oldStartTime, props.oldEndTime, "text-slate-800"],
            ["Proposed", props.newStartTime, props.newEndTime, "text-blue-700"],
          ].map(([label, start, end, color]) => (
            <div key={label as string}>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${color}`}>{label as string}</p>
              <dl className="space-y-1">
                <div><dt className="inline text-slate-500">Start: </dt><dd className={`inline font-medium ${color}`}>{formatDateTime(start as Date, props.portTimezone)}</dd></div>
                <div><dt className="inline text-slate-500">End: </dt><dd className={`inline font-medium ${color}`}>{formatDateTime(end as Date, props.portTimezone)}</dd></div>
                <div><dt className="inline text-slate-500">Duration: </dt><dd className={`inline font-medium ${color}`}>{duration(start as Date, end as Date)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
        {props.saveError ? <div className="mx-5 mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{props.saveError}</div> : null}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={props.onCancel} disabled={props.isSaving} className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={props.onConfirm} disabled={props.isSaving} className="min-h-11 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{props.isSaving ? "Saving…" : "Confirm Resize"}</button>
        </div>
      </div>
    </div>
  );
}
