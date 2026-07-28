import type { PlannerSchedule, ValidatedSchedule, InvalidScheduleRecord } from "./types";

/**
 * Validate a single schedule's geometry and return either a ValidatedSchedule
 * or an InvalidScheduleRecord explaining the problem.
 *
 * This function does NOT access pixel coordinates — all checks are in domain units.
 */
export function validateScheduleGeometry(
  schedule: PlannerSchedule,
  berthLength: number,
): ValidatedSchedule | InvalidScheduleRecord {
  const startTime = schedule.etb ?? schedule.eta;
  const endTime = schedule.etd;

  if (!startTime) {
    return {
      scheduleId: schedule.id,
      vesselName: schedule.vesselName,
      reason: "Missing start time (ETA/ETB)",
    };
  }

  if (!endTime) {
    return {
      scheduleId: schedule.id,
      vesselName: schedule.vesselName,
      reason: "Missing ETD",
    };
  }

  if (endTime <= startTime) {
    return {
      scheduleId: schedule.id,
      vesselName: schedule.vesselName,
      reason: "ETD is not after the start time (ETB or ETA)",
    };
  }

  if (schedule.vesselLoa === null || schedule.vesselLoa === undefined) {
    return {
      scheduleId: schedule.id,
      vesselName: schedule.vesselName,
      reason: "Vessel LOA is not set",
    };
  }

  if (schedule.vesselLoa <= 0) {
    return {
      scheduleId: schedule.id,
      vesselName: schedule.vesselName,
      reason: `Vessel LOA (${schedule.vesselLoa} m) must be greater than zero`,
    };
  }

  if (schedule.berthPositionMeters === null || schedule.berthPositionMeters === undefined) {
    return {
      scheduleId: schedule.id,
      vesselName: schedule.vesselName,
      reason: "Berth position (metres) is not set",
    };
  }

  const positionStart = schedule.berthPositionMeters;
  const positionEnd = positionStart + schedule.vesselLoa;

  if (positionStart < 0) {
    return {
      scheduleId: schedule.id,
      vesselName: schedule.vesselName,
      reason: `Berth position (${positionStart} m) is below zero`,
    };
  }

  if (positionEnd > berthLength) {
    return {
      scheduleId: schedule.id,
      vesselName: schedule.vesselName,
      reason: `Vessel extends to ${positionEnd.toFixed(0)} m but berth is only ${berthLength} m long`,
    };
  }

  return {
    ...schedule,
    startTime,
    endTime,
    positionStart,
    positionEnd,
  };
}

/** Type guard: is the result a valid schedule or an invalid record? */
export function isValidatedSchedule(
  result: ValidatedSchedule | InvalidScheduleRecord,
): result is ValidatedSchedule {
  return "startTime" in result;
}

/** Classify schedules into valid (can be drawn) and invalid (show in warning list). */
export function classifySchedules(
  schedules: PlannerSchedule[],
  berthLength: number,
): {
  valid: ValidatedSchedule[];
  invalid: InvalidScheduleRecord[];
} {
  const valid: ValidatedSchedule[] = [];
  const invalid: InvalidScheduleRecord[] = [];

  for (const s of schedules) {
    const result = validateScheduleGeometry(s, berthLength);
    if (isValidatedSchedule(result)) {
      valid.push(result);
    } else {
      invalid.push(result);
    }
  }

  return { valid, invalid };
}
