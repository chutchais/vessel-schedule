import { toDateTimeLocalValue } from "@/lib/schedules/form-validation";
import type { ScheduleFormValues, ScheduleStatus } from "@/components/schedules/schedule-form-fields";

/** Minimal shape returned by GET /api/schedules/[id] for the edit form. */
export type EditableSchedule = {
  id: string;
  vesselId: string;
  serviceId: string | null;
  voyageNumber: string | null;
  terminalId: string;
  berthId: string | null;
  eta: string;
  etb: string | null;
  etd: string;
  ata: string | null;
  atb: string | null;
  atd: string | null;
  status: string;
  remarks: string | null;
  berthPositionMeters: number | null;
  headingReverse: boolean;
};

/**
 * Converts a fetched schedule into ScheduleFormValues ready for the edit form.
 * Pure function — no side effects.
 */
export function buildEditFormValues(schedule: EditableSchedule): ScheduleFormValues {
  return {
    vesselId: schedule.vesselId,
    serviceId: schedule.serviceId ?? "",
    voyageNumber: schedule.voyageNumber ?? "",
    terminalId: schedule.terminalId,
    berthId: schedule.berthId ?? "",
    eta: toDateTimeLocalValue(schedule.eta),
    etb: toDateTimeLocalValue(schedule.etb),
    etd: toDateTimeLocalValue(schedule.etd),
    ata: toDateTimeLocalValue(schedule.ata),
    atb: toDateTimeLocalValue(schedule.atb),
    atd: toDateTimeLocalValue(schedule.atd),
    status: schedule.status as ScheduleStatus,
    remarks: schedule.remarks ?? "",
    berthPositionMeters: schedule.berthPositionMeters?.toString() ?? "",
    headingReverse: schedule.headingReverse,
  };
}
