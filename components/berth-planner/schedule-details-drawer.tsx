"use client";

import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { HistoryLink } from "@/components/audit-logs/history-link";
import { useCanViewAuditLogs } from "@/components/audit-logs/use-can-view-audit-logs";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import type { ValidatedSchedule } from "@/lib/berth-planner/types";

type ScheduleDetailsDrawerProps = {
  schedule: ValidatedSchedule | null;
  berthName: string;
  isConflict: boolean;
  conflictingVessels: string[];
  timezone: string;
  onClose: () => void;
  onEdit?: () => void;
  showAuditHistory?: boolean;
};

function formatLocalDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function durationLabel(startTime: Date, endTime: Date): string {
  const diffMs = endTime.getTime() - startTime.getTime();
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  BERTHED: "Berthed",
  DEPARTED: "Departed",
  CANCELLED: "Cancelled",
};

const STATUS_BADGE: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  ARRIVED: "bg-yellow-100 text-yellow-700",
  BERTHED: "bg-green-100 text-green-700",
  DEPARTED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-red-100 text-red-600",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}

export function ScheduleDetailsDrawer({
  schedule,
  berthName,
  isConflict,
  conflictingVessels,
  timezone,
  onClose,
  onEdit,
  showAuditHistory = true,
}: ScheduleDetailsDrawerProps) {
  const canViewAuditLogs = useCanViewAuditLogs(showAuditHistory);
  const statusLabel = schedule ? (STATUS_LABELS[schedule.status] ?? schedule.status) : "";
  const statusBadge = schedule ? (STATUS_BADGE[schedule.status] ?? STATUS_BADGE.PLANNED!) : "";

  return (
    <Drawer
      isOpen={schedule !== null}
      title={schedule ? schedule.vesselName : "Schedule Details"}
      description={schedule?.serviceName ?? undefined}
      onRequestClose={onClose}
      footer={schedule ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            {showAuditHistory && canViewAuditLogs ? (
              <HistoryLink
                entityType={AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE}
                entityId={schedule.id}
                entityLabel={schedule.vesselName}
              />
            ) : null}
          </div>
          {onEdit ? (
            <Button onClick={onEdit}>Edit Schedule</Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {schedule ? (
        <div className="space-y-4">
          {isConflict ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">⚠ Berth Conflict</p>
              <p className="mt-1 text-sm text-red-600">
                This vessel overlaps in time and position with:{" "}
                {conflictingVessels.join(", ")}
              </p>
            </div>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vessel
            </h3>
            <div>
              <DetailRow
                label="Status"
                value={
                  <span className={["rounded-full px-2.5 py-0.5 text-xs font-medium", statusBadge].join(" ")}>
                    {statusLabel}
                  </span>
                }
              />
              {schedule.voyageNumber ? (
                <DetailRow label="Voyage" value={schedule.voyageNumber} />
              ) : null}
              {schedule.vesselLoa !== null ? (
                <DetailRow label="LOA" value={`${schedule.vesselLoa} m`} />
              ) : null}
              <DetailRow label="Heading" value={schedule.headingReverse ? "Reversed" : "Normal"} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Berth
            </h3>
            <div>
              <DetailRow label="Berth" value={berthName} />
              <DetailRow
                label="Position"
                value={`${schedule.positionStart} – ${Math.round(schedule.positionEnd)} m`}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Schedule ({timezone})
            </h3>
            <div>
              <DetailRow label="ETA" value={formatLocalDateTime(schedule.eta, timezone)} />
              {schedule.etb ? (
                <DetailRow label="ETB" value={formatLocalDateTime(schedule.etb, timezone)} />
              ) : null}
              <DetailRow label="Start (ETB/ETA)" value={formatLocalDateTime(schedule.startTime, timezone)} />
              <DetailRow label="ETD" value={formatLocalDateTime(schedule.etd, timezone)} />
              <DetailRow
                label="Duration"
                value={durationLabel(schedule.startTime, schedule.endTime)}
              />
            </div>
          </section>

          {schedule.remarks ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Remarks
              </h3>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {schedule.remarks}
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
