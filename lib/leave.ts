// Working-day and leave-balance utilities

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

/** Count Mon–Fri working days between start and end (inclusive), excluding LT public holidays. */
export function countWorkingDays(start: Date, end: Date): number {
  const holidayCache = new Map<number, Set<string>>();
  let count = 0;
  const d = new Date(start);
  d.setUTCHours(0, 0, 0, 0);
  const endMs = new Date(end).setUTCHours(0, 0, 0, 0);

  while (d.getTime() <= endMs) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const year = d.getUTCFullYear();
      if (!holidayCache.has(year)) holidayCache.set(year, getLithuanianHolidays(year));
      const key = d.toISOString().slice(0, 10);
      if (!holidayCache.get(year)!.has(key)) count++;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

/** Prorated entitlement for a given year based on employment start date. */
export function computeEntitlement(annualLeaveDays: number, employmentStartDate: Date | null, year: number): number {
  if (!employmentStartDate) return annualLeaveDays;
  const empYear = employmentStartDate.getUTCFullYear();
  if (year < empYear) return 0;
  if (year > empYear) return annualLeaveDays;
  // First year: prorate by months worked (inclusive of start month)
  const monthsWorked = 12 - employmentStartDate.getUTCMonth();
  return Math.round((monthsWorked / 12) * annualLeaveDays);
}

type LeaveRequest = { startDate: Date; endDate: Date; type: string };

function paidDaysInYear(requests: LeaveRequest[], year: number): number {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  return requests
    .filter((r) => r.type === "PAID")
    .reduce((sum, r) => {
      const s = r.startDate < yearStart ? yearStart : r.startDate;
      const e = r.endDate > yearEnd ? yearEnd : r.endDate;
      return sum + (s <= e ? countWorkingDays(s, e) : 0);
    }, 0);
}

export interface LeaveBalance {
  entitlement: number;
  carryoverDays: number;
  totalAvailable: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

/**
 * Compute leave balance for a given year.
 * Pass ALL approved and pending requests across all years — this function
 * handles year-filtering internally and computes carryover from the previous year.
 */
export function computeLeaveBalance(
  annualLeaveDays: number,
  employmentStartDate: Date | null,
  approvedRequests: LeaveRequest[],
  pendingRequests: LeaveRequest[],
  year: number,
): LeaveBalance {
  const entitlement = computeEntitlement(annualLeaveDays, employmentStartDate, year);

  // Carryover: unused paid leave from previous year (only if not their first year)
  let carryoverDays = 0;
  if (employmentStartDate && employmentStartDate.getUTCFullYear() < year) {
    const prevEntitlement = computeEntitlement(annualLeaveDays, employmentStartDate, year - 1);
    const prevUsed = paidDaysInYear(approvedRequests, year - 1);
    carryoverDays = Math.max(0, prevEntitlement - prevUsed);
  }

  const totalAvailable = entitlement + carryoverDays;
  const usedDays = paidDaysInYear(approvedRequests, year);
  const pendingDays = paidDaysInYear(pendingRequests, year);

  return {
    entitlement,
    carryoverDays,
    totalAvailable,
    usedDays,
    pendingDays,
    remainingDays: Math.max(0, totalAvailable - usedDays - pendingDays),
  };
}
