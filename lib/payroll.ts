export interface PayrollConfig {
  gpmRate: number;
  gpmHighRate: number;
  gpmAnnualThreshold: number;
  sodraEmployee: number;
  sodraEmployer: number;
  npdBase: number;
  npdCoefficient: number;
  minimumWage: number;
  nightPremium: number;
  sundayPremium: number;
  holidayPremium: number;
  overtimePremium: number;
}

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  gpmRate: 0.2,
  gpmHighRate: 0.32,
  gpmAnnualThreshold: 101094,
  sodraEmployee: 0.195,
  sodraEmployer: 0.0177,
  npdBase: 747,
  npdCoefficient: 0.49,
  minimumWage: 1038,
  nightPremium: 0.5,
  sundayPremium: 1.0,
  holidayPremium: 1.0,
  // DK art. 144: overtime minimum 1.5× (i.e. +0.5 on top of base)
  // Can be raised to 2× by employment contract or collective agreement
  overtimePremium: 0.5,
};

export interface PayrollResult {
  grossMonthly: number;
  sodraEmployee: number;
  sodraEmployer: number;
  npd: number;
  taxableIncome: number;
  gpm: number;
  netMonthly: number;
  totalEmployerCost: number;
}

export function calculatePayroll(
  grossMonthly: number,
  config: PayrollConfig = DEFAULT_PAYROLL_CONFIG
): PayrollResult {
  const sodraEmployee = grossMonthly * config.sodraEmployee;
  const sodraEmployer = grossMonthly * config.sodraEmployer;

  const npd =
    grossMonthly <= config.minimumWage
      ? config.npdBase
      : Math.max(
          0,
          config.npdBase -
            config.npdCoefficient * (grossMonthly - config.minimumWage)
        );

  const taxableIncome = Math.max(0, grossMonthly - sodraEmployee - npd);

  const monthlyThreshold = config.gpmAnnualThreshold / 12;
  const gpm =
    taxableIncome <= monthlyThreshold
      ? taxableIncome * config.gpmRate
      : monthlyThreshold * config.gpmRate +
        (taxableIncome - monthlyThreshold) * config.gpmHighRate;

  return {
    grossMonthly,
    sodraEmployee,
    sodraEmployer,
    npd,
    taxableIncome,
    gpm,
    netMonthly: grossMonthly - sodraEmployee - gpm,
    totalEmployerCost: grossMonthly + sodraEmployer,
  };
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat("lt-LT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// ── Lithuanian hour premium calculation ──────────────────────────────────────

export interface HourBreakdown {
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
  sundayHours: number;
  holidayHours: number;
  effectiveGross: number;
}

function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
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

  add(1, 1);   // New Year's Day
  add(2, 16);  // Day of Restoration of the State of Lithuania
  add(3, 11);  // Day of Restoration of Independence
  const easter = getEaster(year);
  s.add(easter.toISOString().slice(0, 10)); // Easter Sunday
  const easterMonday = new Date(easter);
  easterMonday.setUTCDate(easterMonday.getUTCDate() + 1);
  s.add(easterMonday.toISOString().slice(0, 10)); // Easter Monday
  add(5, 1);   // International Labour Day
  add(6, 24);  // St. John's Day (Joninės)
  add(7, 6);   // Statehood Day (Valstybės diena)
  add(8, 15);  // Assumption Day (Žolinė)
  add(11, 1);  // All Saints' Day
  add(12, 25); // Christmas Day
  add(12, 26); // Second Day of Christmas

  return s;
}

// Reuse formatter instances — constructing Intl objects is expensive
const _hourFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hour12: false,
  timeZone: "Europe/Vilnius",
});
const _dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Vilnius",
});
const _weekdayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Europe/Vilnius",
});

function localHour(date: Date): number {
  const h = parseInt(_hourFmt.format(date), 10);
  return h === 24 ? 0 : h;
}

function localDateKey(date: Date): string {
  return _dateFmt.format(date); // YYYY-MM-DD in Vilnius time
}

function isLocalSunday(date: Date): boolean {
  return _weekdayFmt.format(date) === "Sun";
}

/** Returns the ISO Monday date string (YYYY-MM-DD) for the week containing `date` (Vilnius time). */
function getWeekKey(date: Date): string {
  const dateKey = localDateKey(date);
  const [y, m, d] = dateKey.split("-").map(Number);
  const local = new Date(Date.UTC(y, m - 1, d));
  const dow = local.getUTCDay() || 7; // 1=Mon … 7=Sun
  local.setUTCDate(local.getUTCDate() - (dow - 1));
  return local.toISOString().slice(0, 10);
}

/**
 * Splits time entries into premium hour buckets and returns weighted gross.
 *
 * Overtime (DK art. 144): hours beyond 40 in a calendar week (Mon–Sun) earn
 * an additional overtimePremium on top of any other applicable premium.
 *
 * Other premiums stack additively: a Sunday night overtime hour earns
 * base + nightPremium + sundayPremium + overtimePremium.
 *
 * overtimeHours counts all hours beyond 40/week regardless of their type.
 * nightHours / sundayHours / holidayHours count ALL hours of that type
 * (some may also be overtime hours).
 */
export function calculateHourBreakdown(
  entries: Array<{ clockIn: Date; clockOut: Date }>,
  hourlyRate: number,
  config: PayrollConfig
): HourBreakdown {
  // Sort chronologically so weekly running totals accumulate correctly
  const sorted = [...entries].sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());

  const holidayCache = new Map<number, Set<string>>();
  const weeklyHours = new Map<string, number>(); // weekKey → hours worked so far that week

  function holidays(year: number): Set<string> {
    if (!holidayCache.has(year)) holidayCache.set(year, getLithuanianHolidays(year));
    return holidayCache.get(year)!;
  }

  let regularHours = 0;
  let overtimeHours = 0;
  let nightHours = 0;
  let sundayHours = 0;
  let holidayHours = 0;
  let effectiveGross = 0;

  function accumulate(t: Date, durationHours: number) {
    const dateKey = localDateKey(t);
    const year = parseInt(dateKey.slice(0, 4), 10);
    const hour = localHour(t);

    const isNight = hour >= 22 || hour < 6;
    const isHoliday = holidays(year).has(dateKey);
    const isSunday = !isHoliday && isLocalSunday(t);

    // Type-based premium (excluding overtime)
    let typeMultiplier = 1.0;
    if (isNight) typeMultiplier += config.nightPremium;
    if (isHoliday) typeMultiplier += config.holidayPremium;
    else if (isSunday) typeMultiplier += config.sundayPremium;

    // Hour-type buckets (all hours of this type, whether overtime or not)
    if (isHoliday) holidayHours += durationHours;
    else if (isSunday) sundayHours += durationHours;
    else if (isNight) nightHours += durationHours;
    else regularHours += durationHours;

    // Split between regular-rate and overtime-rate portions
    const weekKey = getWeekKey(t);
    const soFar = weeklyHours.get(weekKey) ?? 0;
    weeklyHours.set(weekKey, soFar + durationHours);

    let regularDur: number;
    let otDur: number;
    if (soFar >= 40) {
      regularDur = 0;
      otDur = durationHours;
    } else if (soFar + durationHours > 40) {
      regularDur = 40 - soFar;
      otDur = durationHours - regularDur;
    } else {
      regularDur = durationHours;
      otDur = 0;
    }

    overtimeHours += otDur;
    effectiveGross += hourlyRate * regularDur * typeMultiplier;
    effectiveGross += hourlyRate * otDur * (typeMultiplier + config.overtimePremium);
  }

  for (const entry of sorted) {
    let t = entry.clockIn.getTime();
    const endMs = entry.clockOut.getTime();
    while (t < endMs) {
      const nextHour = (Math.floor(t / 3600000) + 1) * 3600000;
      const segEnd = Math.min(nextHour, endMs);
      accumulate(new Date(t), (segEnd - t) / 3600000);
      t = segEnd;
    }
  }

  return { regularHours, overtimeHours, nightHours, sundayHours, holidayHours, effectiveGross };
}
