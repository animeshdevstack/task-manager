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

export const getAllDaysInMonth = (monthYear: string): Date[] => {
  const { year, monthIndex } = parseMonthYear(monthYear);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days: Date[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, monthIndex, d));
  }
  return days;
};

export const getAllSundaysInMonth = (monthYear: string): Date[] => {
  const { year, monthIndex } = parseMonthYear(monthYear);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundays: Date[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    if (date.getDay() === 0) {
      sundays.push(date);
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
