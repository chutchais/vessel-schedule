type ScheduleTooltipProps = {
  x: number;
  y: number;
  vesselName: string;
  serviceName: string | null;
  status: string;
  startTime: Date;
  endTime: Date;
  positionStart: number;
  positionEnd: number;
  berthName: string;
  timezone: string;
  isConflict: boolean;
  headingReverse: boolean;
};

function formatLocalDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  BERTHED: "Berthed",
  DEPARTED: "Departed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  ARRIVED: "bg-yellow-100 text-yellow-700",
  BERTHED: "bg-green-100 text-green-700",
  DEPARTED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-red-100 text-red-600",
};

export function ScheduleTooltip({
  x,
  y,
  vesselName,
  serviceName,
  status,
  startTime,
  endTime,
  positionStart,
  positionEnd,
  berthName,
  timezone,
  isConflict,
  headingReverse,
}: ScheduleTooltipProps) {
  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.PLANNED!;

  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 50,
        pointerEvents: "none",
        transform: "translate(8px, -50%)",
      }}
      className="max-w-xs rounded-lg border border-slate-200 bg-white shadow-lg"
    >
      <div className="px-3 py-2">
        <p className="font-semibold text-slate-900">{vesselName}</p>
        {serviceName ? (
          <p className="mt-0.5 text-xs text-slate-500">{serviceName}</p>
        ) : null}
      </div>
      <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-700 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Berth</span>
          <span className="font-medium">{berthName}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">From</span>
          <span className="font-medium">{formatLocalDateTime(startTime, timezone)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">To</span>
          <span className="font-medium">{formatLocalDateTime(endTime, timezone)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Position</span>
          <span className="font-medium">
            {positionStart} – {Math.round(positionEnd)} m
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Heading</span>
          <span className="font-medium">{headingReverse ? "Reversed" : "Normal"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Status</span>
          <span className={["rounded-full px-2 py-0.5 font-medium", statusColor].join(" ")}>
            {statusLabel}
          </span>
        </div>
      </div>
      {isConflict ? (
        <div className="border-t border-red-100 bg-red-50 px-3 py-2">
          <p className="text-xs font-medium text-red-700">⚠ Conflict detected</p>
        </div>
      ) : null}
    </div>
  );
}
