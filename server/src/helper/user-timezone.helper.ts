import type { Request } from "express";

const DEFAULT_TIMEZONE = "UTC";

/** Parse IANA timezone from request header; fallback to UTC when missing or invalid. */
export const getUserTimezone = (req: Pick<Request, "headers">): string => {
  const raw = req.headers["x-user-timezone"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

type CalendarParts = {
  year: number;
  month: number;
  day: number;
};

const getCalendarPartsInTimezone = (
  timezone: string,
  instant: Date = new Date(),
): CalendarParts => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(instant);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  if (!year || !month || !day) {
    throw new Error(`Invalid calendar parts for timezone: ${timezone}`);
  }
  return { year, month, day };
};

/** Today's YYYY-MM-DD in the given IANA timezone. */
export const getTodayYmdInTimezone = (
  timezone: string,
  instant: Date = new Date(),
): string => {
  const { year, month, day } = getCalendarPartsInTimezone(timezone, instant);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
};

/** Today's YYYY-MM in the given IANA timezone. */
export const getCurrentMonthYmInTimezone = (
  timezone: string,
  instant: Date = new Date(),
): string => {
  const { year, month } = getCalendarPartsInTimezone(timezone, instant);
  const m = String(month).padStart(2, "0");
  return `${year}-${m}`;
};

/** Build a Date at local noon for dated-task validation (matches client noon pattern). */
export const referenceDateFromYmd = (ymd: string): Date => {
  const [yRaw, mRaw, dRaw] = ymd.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  if (!y || !m || !d) {
    throw new Error(`Invalid YMD: ${ymd}`);
  }
  return new Date(y, m - 1, d, 12, 0, 0);
};
