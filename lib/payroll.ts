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
  return h === 24 ? 0 : h; // some environments return "24" for midnight
}

function localDateKey(date: Date): string {
  return _dateFmt.format(date); // YYYY-MM-DD in Vilnius time
}

function isLocalSunday(date: Date): boolean {
  return _weekdayFmt.format(date) === "Sun";
}

/**
 * Splits time entries into premium hour buckets and returns weighted gross.
 * Premiums stack: a Sunday night hour gets both nightPremium and sundayPremium.
 * Night hours that fall on a Sunday are counted in sundayHours, not nightHours.
 */
export function calculateHourBreakdown(
  entries: Array<{ clockIn: Date; clockOut: Date }>,
  hourlyRate: number,
  config: PayrollConfig
): HourBreakdown {
  const holidayCache = new Map<number, Set<string>>();

  function holidays(year: number): Set<string> {
    if (!holidayCache.has(year)) holidayCache.set(year, getLithuanianHolidays(year));
    return holidayCache.get(year)!;
  }

  let regularHours = 0;
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

    let multiplier = 1.0;
    if (isNight) multiplier += config.nightPremium;
    if (isHoliday) multiplier += config.holidayPremium;
    else if (isSunday) multiplier += config.sundayPremium;

    if (isHoliday) holidayHours += durationHours;
    else if (isSunday) sundayHours += durationHours;
    else if (isNight) nightHours += durationHours;
    else regularHours += durationHours;

    effectiveGross += hourlyRate * durationHours * multiplier;
  }

  for (const entry of entries) {
    const startMs = entry.clockIn.getTime();
    const endMs = entry.clockOut.getTime();
    const totalMinutes = Math.floor((endMs - startMs) / 60000);

    for (let i = 0; i < totalMinutes; i++) {
      accumulate(new Date(startMs + i * 60000), 1 / 60);
    }

    const remainingMs = (endMs - startMs) % 60000;
    if (remainingMs > 0) {
      accumulate(new Date(startMs + totalMinutes * 60000), remainingMs / 3600000);
    }
  }

  return { regularHours, nightHours, sundayHours, holidayHours, effectiveGross };
}
