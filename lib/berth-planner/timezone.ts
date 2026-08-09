/**
 * Timezone helpers for the Berth Planner.
 * All date labels and week boundaries are calculated in the port's IANA timezone,
 * not the browser timezone.
 */

/** Format a Date as a short time string (e.g. "14:30") in the given IANA timezone. */
export function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Format a Date as a short date string (e.g. "Mon 28 Jul") in the given IANA timezone. */
export function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** Format a Date as "28 Jul 14:30" in the given IANA timezone. */
export function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Return the UTC offset label for a timezone at a given date, e.g. "UTC+7". */
export function formatTimezoneOffset(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(date);
    const tz = parts.find((p) => p.type === "timeZoneName");
    return tz?.value ?? timezone;
  } catch {
    return timezone;
  }
}

// ─── Week calculation helpers ─────────────────────────────────────────────────

/**
 * Find the UTC instant representing midnight (00:00:00) on a specific calendar
 * date (year/month/day) in the given IANA timezone.
 *
 * Uses noon UTC to determine the timezone offset, which avoids DST ambiguity
 * since DST transitions never occur at noon in any real-world timezone.
 */
export function toLocalMidnight(year: number, month: number, day: number, timezone: string): Date {
  // Use noon UTC on the target date to find the UTC offset
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(noonUTC);

  const getP = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const localYear = getP("year");
  const localMonth = getP("month");
  const localDay = getP("day");
  const localH = getP("hour") === 24 ? 0 : getP("hour");
  const localM = getP("minute");

  // Build a synthetic "local as UTC" date from the parts
  const localAsUTC = new Date(Date.UTC(localYear, localMonth - 1, localDay, localH, localM));

  // UTC offset in ms = localAsUTC - noonUTC
  const offsetMs = localAsUTC.getTime() - noonUTC.getTime();

  // Local midnight = UTC midnight of that date - offset
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(utcMidnight.getTime() - offsetMs);
}

/**
 * Return the ISO weekday (1=Monday … 7=Sunday) for a UTC instant in a given timezone.
 */
function isoWeekdayInTimezone(date: Date, timezone: string): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return map[part] ?? 1;
}

/**
 * Return the UTC instant for Monday 00:00:00 of the calendar week that contains
 * `date`, where weeks are defined by the given IANA timezone.
 *
 * Week start = Monday 00:00 in the port timezone.
 * Week end (exclusive) = the following Monday 00:00.
 */
export function getWeekStart(date: Date, timezone: string): Date {
  // Step 1: Determine the calendar date of `date` in the timezone
  const localDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  // en-CA guarantees "YYYY-MM-DD" format
  const [yearStr, monthStr, dayStr] = localDateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-based
  const day = Number(dayStr);

  // Step 2: Find day of week using noon UTC on that calendar date
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = isoWeekdayInTimezone(noonUTC, timezone); // 1=Mon … 7=Sun
  const daysBack = weekday - 1; // days to subtract to reach Monday

  // Step 3: Compute Monday's noon UTC (handles month/year rollovers)
  const mondayNoon = new Date(noonUTC.getTime() - daysBack * 86400000);

  // Step 4: Get Monday's calendar date in the timezone
  const mondayDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(mondayNoon);
  const [mY, mM, mD] = mondayDateStr.split("-").map(Number);

  return toLocalMidnight(mY!, mM!, mD!, timezone);
}

/**
 * Return the exclusive week-end instant: exactly 7 × 24 h after weekStart
 * expressed as the next Monday 00:00 in the same timezone.
 *
 * Because `weekStart` is already aligned to Monday 00:00 in the timezone,
 * the next Monday 00:00 is simply weekStart + 7 days (DST-aware).
 */
export function getWeekEnd(weekStart: Date, timezone: string): Date {
  // Move 7 × 24 h forward from weekStart (this crosses any DST boundary correctly
  // because we re-anchor to the calendar date, not just add ms).
  const sevenDaysLater = new Date(weekStart.getTime() + 7 * 86400000);

  // Re-anchor to midnight in the timezone to handle DST spring/fall transitions
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sevenDaysLater);
  const [y, m, d] = dateStr.split("-").map(Number);
  return toLocalMidnight(y!, m!, d!, timezone);
}

/**
 * Shift a week-start by `weeks` calendar weeks (positive = forward, negative = back).
 * Each step moves exactly 7 days and re-anchors to midnight in the timezone.
 */
export function addWeeks(weekStart: Date, weeks: number, timezone: string): Date {
  const shifted = new Date(weekStart.getTime() + weeks * 7 * 86400000);
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
  const [y, m, d] = dateStr.split("-").map(Number);
  return toLocalMidnight(y!, m!, d!, timezone);
}

/**
 * Return a human-readable week label, e.g. "28 Jul – 3 Aug 2026".
 * weekEnd is exclusive (next Monday), so we show weekEnd - 1 day as Sunday.
 */
export function formatWeekLabel(weekStart: Date, weekEnd: Date, timezone: string): string {
  const sunday = new Date(weekEnd.getTime() - 1000); // 1 ms before weekEnd = last ms of Sunday
  const start = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
  }).format(weekStart);
  const end = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(sunday);
  return `${start} – ${end}`;
}

/**
 * Return every 4-hour UTC instant between weekStart and weekEnd (exclusive).
 * These are aligned to absolute UTC hours (00:00, 04:00, 08:00 … UTC), not
 * local timezone hours.  The caller maps them to screen-Y positions using
 * `timeToPixel`.  Local-midnight grid lines are drawn separately from
 * `getMidnightsBetween`.
 */
export function get4HourMarks(weekStart: Date, weekEnd: Date, timezone: string): Date[] {
  const marks: Date[] = [];
  // For each day covered by the range, generate 04:00, 08:00, 12:00, 16:00, 20:00 in local time
  const HOURS = [4, 8, 12, 16, 20];

  // Iterate over each day between weekStart and weekEnd
  let cursor = new Date(weekStart);
  while (cursor < weekEnd) {
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cursor);
    const [y, m, d] = dateStr.split("-").map(Number);

    for (const hour of HOURS) {
      // Use same DST-safe offset trick as toLocalMidnight
      const noonUTC = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", hour12: false,
      }).formatToParts(noonUTC);
      const getP = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value ?? "0");
      const localH = getP("hour") === 24 ? 0 : getP("hour");
      const localM = getP("minute");
      const localAsUTC = new Date(Date.UTC(getP("year"), getP("month") - 1, getP("day"), localH, localM));
      const offsetMs = localAsUTC.getTime() - noonUTC.getTime();
      const mark = new Date(Date.UTC(y!, m! - 1, d!, hour, 0, 0) - offsetMs);
      if (mark > weekStart && mark < weekEnd) {
        marks.push(mark);
      }
    }

    cursor = new Date(cursor.getTime() + 86400000);
  }

  return marks;
}

/**
 * Return the UTC instants for local-midnight (00:00) in the given timezone
 * for each calendar day within [weekStart, weekEnd).
 */
export function getMidnightsBetween(weekStart: Date, weekEnd: Date, timezone: string): Date[] {
  const midnights: Date[] = [];
  let cursor = new Date(weekStart);

  while (cursor < weekEnd) {
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cursor);
    const [y, m, d] = dateStr.split("-").map(Number);
    const midnight = toLocalMidnight(y!, m!, d!, timezone);

    if (midnight >= weekStart && midnight < weekEnd) {
      midnights.push(midnight);
    }

    // Advance ~24 h to next day
    cursor = new Date(cursor.getTime() + 86400000);
  }

  return midnights;
}
