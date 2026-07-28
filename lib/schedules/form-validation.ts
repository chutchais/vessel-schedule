import type { ScheduleFormValues } from "@/components/schedules/schedule-form-fields";

type VesselForValidation = {
  id: string;
  lengthOverall?: number | string | null;
};

type BerthForValidation = {
  id: string;
  berthLength: number;
};

type ScheduleForConflictCheck = {
  id: string;
  berthId: string | null;
  status: string;
  eta: string;
  etb: string | null;
  etd: string;
};

export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function toDateTimeLocalValueInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hourPart = getPart("hour");
  const hour = hourPart === "24" ? "00" : hourPart;
  const minute = getPart("minute");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function toIsoUtc(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function getVesselFitError(input: {
  form: ScheduleFormValues;
  vessels: VesselForValidation[];
  berths: BerthForValidation[];
}): string | null {
  const { form, vessels, berths } = input;
  if (!form.vesselId || !form.berthId || form.berthPositionMeters.trim() === "") {
    return null;
  }

  const berth = berths.find((item) => item.id === form.berthId);
  if (!berth) return null;

  const vessel = vessels.find((item) => item.id === form.vesselId);
  if (!vessel) return null;

  const position = parseNumber(form.berthPositionMeters);
  if (position === null || !Number.isInteger(position) || position < 0) {
    return "Berth position meters must be a non-negative integer.";
  }

  const loa = parseNumber(vessel.lengthOverall ?? null);
  if (loa === null) {
    return "Selected vessel has no LOA. Set vessel length overall before placing it on a berth.";
  }

  if (loa <= 0) {
    return "Selected vessel LOA must be greater than zero.";
  }

  const positionEnd = position + loa;
  if (positionEnd > berth.berthLength) {
    return `Selected vessel does not fit this berth. Position + LOA = ${positionEnd.toFixed(1)} m, berth length = ${berth.berthLength} m.`;
  }

  return null;
}

export function getBerthConflictWarning(input: {
  form: ScheduleFormValues;
  schedules: ScheduleForConflictCheck[];
  excludeScheduleId?: string | null;
}): string | null {
  const { form, schedules, excludeScheduleId } = input;
  if (!form.berthId || !form.eta || !form.etd) return null;

  const eta = new Date(form.eta);
  const etd = new Date(form.etd);
  if (Number.isNaN(eta.getTime()) || Number.isNaN(etd.getTime()) || etd <= eta) return null;

  const start = form.etb ? new Date(form.etb) : eta;
  if (Number.isNaN(start.getTime())) return null;

  const overlaps = schedules
    .filter((schedule) => schedule.berthId === form.berthId)
    .filter((schedule) => schedule.status !== "CANCELLED")
    .filter((schedule) => !excludeScheduleId || schedule.id !== excludeScheduleId)
    .some((schedule) => {
      const existingEta = new Date(schedule.eta);
      const existingEtd = new Date(schedule.etd);
      if (Number.isNaN(existingEta.getTime()) || Number.isNaN(existingEtd.getTime())) return false;
      const existingStart = schedule.etb ? new Date(schedule.etb) : existingEta;
      if (Number.isNaN(existingStart.getTime())) return false;
      return start < existingEtd && etd > existingStart;
    });

  return overlaps ? "Selected berth has overlapping schedules in this time window." : null;
}
