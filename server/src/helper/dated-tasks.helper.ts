const DATE_YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export const formatDateYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const isDateInMonth = (dateStr: string, monthYear: string): boolean =>
  dateStr.startsWith(`${monthYear}-`);

export const getLastDateOfMonth = (monthYear: string): string => {
  const [yearRaw, monthRaw] = monthYear.split("-");
  const year = Number(yearRaw);
  const monthNum = Number(monthRaw);
  if (!year || !monthNum) {
    throw new Error(`Invalid month year: ${monthYear}`);
  }
  const lastDay = new Date(year, monthNum, 0).getDate();
  return `${monthYear}-${String(lastDay).padStart(2, "0")}`;
};

export const isAllowedDatedTaskDate = (
  dateStr: string,
  monthYear: string,
  referenceDate: Date = new Date(),
): boolean => {
  if (!DATE_YMD_RE.test(dateStr) || !isDateInMonth(dateStr, monthYear)) {
    return false;
  }
  return dateStr >= formatDateYmd(referenceDate);
};

export const getEditableDateBounds = (
  monthYear: string,
  referenceDate: Date = new Date(),
): { min: string; max: string } => {
  const monthStart = `${monthYear}-01`;
  const max = getLastDateOfMonth(monthYear);
  const todayYmd = formatDateYmd(referenceDate);
  const min =
    todayYmd >= monthStart && todayYmd <= max ? todayYmd : monthStart;
  return { min, max };
};

type DatedTaskGroup = {
  date: string;
  tasks?: { _id?: { toString(): string } }[];
};

export const buildDatedSubTaskIdMap = (
  datedTasks: DatedTaskGroup[] | undefined,
): Map<string, string> => {
  const map = new Map<string, string>();
  for (const entry of datedTasks ?? []) {
    const date = entry.date?.trim?.() ?? entry.date;
    if (!date) continue;
    for (const task of entry.tasks ?? []) {
      if (task._id) {
        map.set(task._id.toString(), date);
      }
    }
  }
  return map;
};

export const normalizeDatedTasks = (
  datedTasks: unknown,
  monthYear: string,
  referenceDate: Date = new Date(),
): { date: string; tasks: unknown[] }[] => {
  if (!Array.isArray(datedTasks)) {
    return [];
  }

  const byDate = new Map<string, unknown[]>();

  for (const entry of datedTasks) {
    if (!entry || typeof entry !== "object") continue;
    const rawDate = "date" in entry && typeof entry.date === "string" ? entry.date.trim() : "";
    if (!DATE_YMD_RE.test(rawDate)) {
      throw new Error("Invalid date in DatedTasks. Use YYYY-MM-DD.");
    }
    if (!isDateInMonth(rawDate, monthYear)) {
      throw new Error(`Date ${rawDate} must fall within month ${monthYear}`);
    }
    if (!isAllowedDatedTaskDate(rawDate, monthYear, referenceDate)) {
      throw new Error(
        `Date ${rawDate} must be today or later within ${monthYear}`,
      );
    }
    const tasks = "tasks" in entry && Array.isArray(entry.tasks) ? entry.tasks : [];
    const existing = byDate.get(rawDate) ?? [];
    byDate.set(rawDate, [...existing, ...tasks]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tasks]) => ({ date, tasks }));
};
