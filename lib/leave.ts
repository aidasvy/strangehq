// Working-day and leave-balance utilities

// Reuse the same Easter algorithm and holiday list from payroll
function getEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function getLithuanianHolidays(year: number): Set<string> {
  const s = new Set<string>();
  const add = (m: number, d: number) =>
    s.add(`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  add(1, 1); add(2, 16); add(3, 11);
  const easter = getEaster(year);
  s.add(easter.toISOString().slice(0, 10));
  const em = new Date(easter); em.setUTCDate(em.getUTCDate() + 1);
  s.add(em.toISOString().slice(0, 10));
  add(5, 1); add(6, 24); add(7, 6); add(8, 15); add(11, 1); add(12, 25); add(12, 26);
  return s;
}

/** Count Mon–Fri days between start and end (inclusive), excluding LT public holidays. */
export function countWorkingDays(start: Date, end: Date): number {
  const holidayCache = new Map<number, Set<string>>();
  let count = 0;
  const d = new Date(start);
  d.setUTCHours(0, 0, 0, 0);
  const endMs = new Date(end).setUTCHours(0, 0, 0, 0);

  while (d.getTime() <= endMs) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) { // Mon–Fri
      const year = d.getUTCFullYear();
      if (!holidayCache.has(year)) holidayCache.set(year, getLithuanianHolidays(year));
      const key = d.toISOString().slice(0, 10);
      if (!holidayCache.get(year)!.has(key)) count++;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export interface LeaveBalance {
  entitlement: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export function computeLeaveBalance(
  entitlement: number,
  approvedRequests: Array<{ startDate: Date; endDate: Date; type: string }>,
  pendingRequests: Array<{ startDate: Date; endDate: Date; type: string }>,
  year: number
): LeaveBalance {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  function daysInYear(reqs: typeof approvedRequests) {
    return reqs
      .filter((r) => r.type === "PAID")
      .reduce((sum, r) => {
        const s = r.startDate < yearStart ? yearStart : r.startDate;
        const e = r.endDate > yearEnd ? yearEnd : r.endDate;
        return sum + (s <= e ? countWorkingDays(s, e) : 0);
      }, 0);
  }

  const usedDays = daysInYear(approvedRequests);
  const pendingDays = daysInYear(pendingRequests);

  return {
    entitlement,
    usedDays,
    pendingDays,
    remainingDays: Math.max(0, entitlement - usedDays),
  };
}
