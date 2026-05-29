import { formatDateYmd } from "./dated-tasks.helper";

/** Parse "YYYY-MM" into year and 0-based month index. */
export const parseMonthYear = (
  monthYear: string,
): { year: number; monthIndex: number } => {
  const [y, m] = monthYear.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) {
    throw new Error(`Invalid month year: ${monthYear}`);
  }
  return { year: y, monthIndex: m - 1 };
};

export type ReviewDateSlot = {
  date: Date;
  ymd: string;
};

/** Build YYYY-MM-DD from integer calendar parts (timezone-independent). */
export const formatDateYmdFromParts = (
  year: number,
  monthIndex: number,
  day: number,
): string => {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
};

/** UTC-based YMD for legacy Mongo dates stored with UTC offset shifts. */
export const formatDateYmdUtc = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Index review slots by local and UTC YMD so legacy stored dates still match. */
export const indexReviewSlotByYmd = <T>(
  entries: T[],
  getDateField: (entry: T) => Date,
): Map<string, T> => {
  const map = new Map<string, T>();
  for (const entry of entries) {
    const d = getDateField(entry);
    const localYmd = formatDateYmd(d);
    const utcYmd = formatDateYmdUtc(d);
    map.set(localYmd, entry);
    if (utcYmd !== localYmd) {
      map.set(utcYmd, entry);
    }
  }
  return map;
};

/**
 * Resolve an existing review slot for a canonical calendar day (YYYY-MM-DD).
 * Falls back to day-of-month matching within monthYear for legacy UTC-shifted dates.
 */
export const findReviewSlotByYmd = <T>(
  entries: T[],
  byYmd: Map<string, T>,
  ymd: string,
  monthYear: string,
  getDateField: (entry: T) => Date,
): T | undefined => {
  const direct = byYmd.get(ymd);
  if (direct) return direct;

  const { year, monthIndex } = parseMonthYear(monthYear);
  const dayNum = Number(ymd.split("-")[2]);
  if (!dayNum) return undefined;

  return entries.find((entry) => {
    const d = getDateField(entry);
    if (formatDateYmd(d) === ymd || formatDateYmdUtc(d) === ymd) return true;

    const localMatch =
      d.getFullYear() === year &&
      d.getMonth() === monthIndex &&
      d.getDate() === dayNum;
    const utcMatch =
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === monthIndex &&
      d.getUTCDate() === dayNum;

    if (localMatch || utcMatch) return true;

    // Legacy: local-midnight dates stored with UTC offset (±1 calendar day)
    const localDayDiff = Math.abs(d.getDate() - dayNum);
    const utcDayDiff = Math.abs(d.getUTCDate() - dayNum);
    const inSameLocalMonth =
      d.getFullYear() === year && d.getMonth() === monthIndex;
    const inSameUtcMonth =
      d.getUTCFullYear() === year && d.getUTCMonth() === monthIndex;

    return (
      (inSameLocalMonth && localDayDiff === 1) ||
      (inSameUtcMonth && utcDayDiff === 1)
    );
  });
};

export const getAllDaysInMonth = (monthYear: string): ReviewDateSlot[] => {
  const { year, monthIndex } = parseMonthYear(monthYear);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days: ReviewDateSlot[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: new Date(year, monthIndex, d),
      ymd: formatDateYmdFromParts(year, monthIndex, d),
    });
  }
  return days;
};

export const getAllSundaysInMonth = (monthYear: string): ReviewDateSlot[] => {
  const { year, monthIndex } = parseMonthYear(monthYear);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundays: ReviewDateSlot[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, monthIndex, d).getDay() === 0) {
      sundays.push({
        date: new Date(year, monthIndex, d),
        ymd: formatDateYmdFromParts(year, monthIndex, d),
      });
    }
  }
  return sundays;
};

export const getLastDayOfMonth = (monthYear: string): Date => {
  const { year, monthIndex } = parseMonthYear(monthYear);
  return new Date(year, monthIndex + 1, 0);
};

export const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
