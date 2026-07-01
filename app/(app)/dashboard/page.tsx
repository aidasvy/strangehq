import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "@/lib/i18n/translations";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const userId = session.user.id;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [membership, openEntry, todayShifts, upcomingShifts, pendingHolidays, pendingEntries, weekEntries] =
    await Promise.all([
      db.companyMember.findFirst({ where: { userId }, include: { company: true } }),
      db.timeEntry.findFirst({ where: { userId, clockOut: null } }),
      db.scheduleShift.findMany({
        where: { userId, date: { gte: todayStart, lte: todayEnd }, schedule: { status: "PUBLISHED" } },
        orderBy: { startTime: "asc" },
      }),
      db.scheduleShift.findMany({
        where: { userId, date: { gt: todayEnd }, schedule: { status: "PUBLISHED" } },
        orderBy: { date: "asc" },
        take: 4,
      }),
      db.holidayRequest.count({ where: { userId, status: "PENDING" } }),
      db.timeEntry.count({ where: { userId, status: "PENDING", clockOut: { not: null } } }),
      db.timeEntry.findMany({
        where: { userId, status: "APPROVED", clockIn: { gte: weekStart }, clockOut: { not: null } },
      }),
    ]);

  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  const weekHours = weekEntries.reduce((sum, e) => {
    if (!e.clockOut) return sum;
    return sum + (e.clockOut.getTime() - e.clockIn.getTime()) / 3600000;
  }, 0);

  const hourlyRate = membership?.hourlyRate ? parseFloat(membership.hourlyRate.toString()) : null;
  const estimatedGross = hourlyRate ? weekHours * hourlyRate : null;

  const todayShift = todayShifts[0] ?? null;

  return (
    <div className="p-5 space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-black">
          {greeting(t)}, {session.user.name?.split(" ")[0] ?? ""}
        </h1>
        <p className="text-sm text-stone-400">{membership.company.name}</p>
      </div>

      {/* Primary clock status card */}
      {openEntry ? (
        <Link
          href="/dashboard/hours"
          className="block rounded-xl bg-green-600 p-5 text-white hover:bg-green-700 transition-colors shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">{t.dash.shiftActive}</p>
              <p className="text-3xl font-mono font-bold mt-1 tabular-nums tracking-tight">
                {elapsedString(openEntry.clockIn)}
              </p>
              <p className="text-green-200 text-xs mt-1">
                {t.dash.since} {fmt(openEntry.clockIn, t.dateLocale)} · {t.dash.tapToEnd}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500 bg-opacity-50 px-2.5 py-1 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          </div>
        </Link>
      ) : (
        <Link
          href="/dashboard/hours"
          className="block rounded-xl bg-white border border-stone-200 shadow-sm p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-stone-800">{t.dash.shiftIdle}</p>
              {todayShift ? (
                <p className="text-sm text-stone-500 mt-0.5">
                  {t.dash.today}: <span className="font-mono">{todayShift.startTime} – {todayShift.endTime}</span>
                </p>
              ) : (
                <p className="text-sm text-stone-400 mt-0.5">{t.dash.noShiftsToday}</p>
              )}
            </div>
            <div className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">
              {t.dash.start}
            </div>
          </div>
        </Link>
      )}

      {/* Alerts */}
      {pendingEntries > 0 && (
        <Link
          href="/dashboard/hours"
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
          </svg>
          <p className="text-sm text-amber-800">{t.dash.pendingEntries(pendingEntries)}</p>
          <span className="ml-auto text-xs text-amber-600">{t.dash.view}</span>
        </Link>
      )}
      {pendingHolidays > 0 && (
        <Link
          href="/dashboard/holidays"
          className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 hover:bg-blue-100 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="3.75" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25M12 18.75V21M5.636 5.636l1.591 1.591M16.773 16.773l1.591 1.591M3 12h2.25M18.75 12H21M5.636 18.364l1.591-1.591M16.773 7.227l1.591-1.591" />
          </svg>
          <p className="text-sm text-blue-800">{t.dash.pendingHolidays(pendingHolidays)}</p>
          <span className="ml-auto text-xs text-blue-600">{t.dash.view}</span>
        </Link>
      )}

      {/* Quick actions — icon tiles, no overflow */}
      <div className="grid grid-cols-4 gap-2">
        <QuickTile href="/dashboard/hours" icon={<ClockIcon />} label={t.nav.hours} />
        <QuickTile href="/dashboard/schedule" icon={<CalendarIcon />} label={t.nav.schedule} />
        <QuickTile href="/dashboard/availability" icon={<ChecklistIcon />} label={t.nav.availability} />
        <QuickTile href="/dashboard/holidays" icon={<PlaneIcon />} label={t.nav.holidays} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wider font-medium">{t.dash.thisWeek}</p>
          <p className="text-2xl font-mono font-bold text-stone-900 mt-1 tabular-nums">{weekHours.toFixed(1)}h</p>
          {estimatedGross !== null ? (
            <p className="text-xs text-stone-400 mt-0.5">≈ €{estimatedGross.toFixed(2)} gross</p>
          ) : (
            <p className="text-xs text-stone-400 mt-0.5">{t.dash.approvedHours}</p>
          )}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wider font-medium">{t.dash.nextShift}</p>
          {upcomingShifts[0] ? (
            <>
              <p className="text-sm font-semibold text-stone-900 mt-1">
                {fmtDate(upcomingShifts[0].date, t.dateLocale)}
              </p>
              <p className="text-xs font-mono text-stone-500 mt-0.5">
                {upcomingShifts[0].startTime} – {upcomingShifts[0].endTime}
              </p>
            </>
          ) : (
            <p className="text-sm text-stone-400 mt-1">{t.dash.notAssigned}</p>
          )}
        </div>
      </div>

      {/* Upcoming shifts list */}
      {upcomingShifts.length > 1 && (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">{t.dash.upcomingShifts}</h2>
            <Link href="/dashboard/schedule" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              {t.dash.fullSchedule}
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {upcomingShifts.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-stone-800">{fmtDate(s.date, t.dateLocale)}</span>
                <span className="text-xs font-mono text-stone-500 tabular-nums">{s.startTime} – {s.endTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickTile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-stone-200 bg-white shadow-sm py-4 px-2 hover:shadow-md hover:border-stone-300 transition-all"
    >
      <span className="text-stone-600">{icon}</span>
      <span className="text-xs font-medium text-stone-700 text-center leading-tight">{label}</span>
    </Link>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <polyline points="3 6 4 7 6 5" />
      <polyline points="3 12 4 13 6 11" />
      <polyline points="3 18 4 19 6 17" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4s-2 1-3.5 2.5L8 11 .8 9.2C0 9 0 8.5.5 8l1-1C2 6 3 5.9 4 6.2L6.9 7 9 5H7L6 4h4l1 1 2-2h2l-1 3 3-1h1l-1 4-2 1z" />
    </svg>
  );
}

function elapsedString(clockIn: Date): string {
  const ms = Date.now() - new Date(clockIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function greeting(t: ReturnType<typeof getTranslations>) {
  const h = new Date().getHours();
  if (h < 12) return t.dash.greetingMorning;
  if (h < 17) return t.dash.greetingAfternoon;
  return t.dash.greetingEvening;
}

function fmt(d: Date, dateLocale: string) {
  return new Date(d).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: Date, dateLocale: string) {
  return new Date(d).toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short" });
}
