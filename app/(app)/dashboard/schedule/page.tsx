import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "@/lib/i18n/translations";
import { SwapButton, IncomingSwapCard, ColleagueShift, MyShift, IncomingSwap } from "./swap-panel";

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  const thisWeekStart = getMonday(new Date());

  // All weeks that have a published schedule for this company — lets the
  // employee jump straight to any week with real data instead of guessing offsets.
  const publishedWeeks = await db.schedule.findMany({
    where: { companyId: membership.companyId, status: "PUBLISHED" },
    select: { weekStart: true },
    distinct: ["weekStart"],
    orderBy: { weekStart: "asc" },
  });
  const weekOptions = [...new Set(publishedWeeks.map((w) => w.weekStart.getTime()))]
    .sort((a, b) => a - b)
    .map((ms) => new Date(ms));

  const { week } = await searchParams;
  const requestedWeek = week ? new Date(week) : thisWeekStart;
  const weekStart = !isNaN(requestedWeek.getTime()) ? getMonday(requestedWeek) : thisWeekStart;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const currentIndex = weekOptions.findIndex((w) => w.getTime() === weekStart.getTime());
  const prevWeek = currentIndex > 0 ? weekOptions[currentIndex - 1] : new Date(weekStart.getTime() - 7 * 86400000);
  const nextWeek = currentIndex >= 0 && currentIndex < weekOptions.length - 1
    ? weekOptions[currentIndex + 1]
    : new Date(weekStart.getTime() + 7 * 86400000);

  const [schedules, incomingSwaps] = await Promise.all([
    db.schedule.findMany({
      where: {
        companyId: membership.companyId,
        weekStart,
        status: "PUBLISHED",
      },
      include: {
        location: { select: { name: true } },
        shifts: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { date: "asc" },
        },
      },
    }),
    db.shiftSwapRequest.findMany({
      where: {
        targetUserId: session.user.id,
        status: "PENDING_TARGET",
        targetShift: { date: { gte: weekStart, lte: weekEnd } },
      },
      include: {
        requester: { select: { name: true } },
        requesterShift: { include: { schedule: { select: { location: { select: { name: true } } } } } },
        targetShift: { include: { schedule: { select: { location: { select: { name: true } } } } } },
      },
    }),
  ]);

  const myShifts = schedules.flatMap((s) =>
    s.shifts
      .filter((shift) => shift.userId === session.user.id)
      .map((shift) => ({ ...shift, locationName: s.location.name }))
  );

  // All published shifts this week (for swap targets), excluding my own
  const colleagueShifts: ColleagueShift[] = schedules.flatMap((s) =>
    s.shifts
      .filter((shift) => shift.userId !== session.user.id)
      .map((shift) => ({
        id: shift.id,
        userId: shift.userId,
        userName: shift.user.name ?? "Unknown",
        date: shift.date.toISOString(),
        startTime: shift.startTime,
        endTime: shift.endTime,
        locationName: s.location.name,
      }))
  );

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const myShiftProps: MyShift[] = myShifts.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
    locationName: s.locationName,
  }));

  const incomingSwapProps: IncomingSwap[] = incomingSwaps.map((sw) => ({
    id: sw.id,
    status: sw.status,
    requesterName: sw.requester.name ?? "A colleague",
    requesterShift: {
      date: sw.requesterShift.date.toISOString(),
      startTime: sw.requesterShift.startTime,
      endTime: sw.requesterShift.endTime,
      locationName: sw.requesterShift.schedule.location.name,
    },
    myShift: {
      date: sw.targetShift.date.toISOString(),
      startTime: sw.targetShift.startTime,
      endTime: sw.targetShift.endTime,
      locationName: sw.targetShift.schedule.location.name,
    },
  }));

  const isThisWeek = weekStart.getTime() === thisWeekStart.getTime();

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backHome}</Link>
      <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-black">{t.dashSchedule.title}</h1>

      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/schedule?week=${prevWeek.toISOString().slice(0, 10)}`}
          className="rounded-md border border-stone-200 px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          aria-label="Previous week"
        >
          ←
        </Link>
        <p className="text-sm text-stone-500 flex-1 text-center">
          {t.dashSchedule.weekOf} {weekStart.toLocaleDateString(t.dateLocale, { day: "numeric", month: "long", year: "numeric" })}
          {isThisWeek && <span className="ml-2 text-xs text-stone-400">({t.adminSchedule.weekLabels[0]})</span>}
        </p>
        <Link
          href={`/dashboard/schedule?week=${nextWeek.toISOString().slice(0, 10)}`}
          className="rounded-md border border-stone-200 px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          aria-label="Next week"
        >
          →
        </Link>
      </div>

      {weekOptions.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {weekOptions.map((w) => {
            const active = w.getTime() === weekStart.getTime();
            return (
              <Link
                key={w.toISOString()}
                href={`/dashboard/schedule?week=${w.toISOString().slice(0, 10)}`}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {w.toLocaleDateString(t.dateLocale, { day: "numeric", month: "short" })}
                {w.getTime() === thisWeekStart.getTime() && !active ? " •" : ""}
              </Link>
            );
          })}
        </div>
      )}

      {myShifts.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-6 text-center text-sm text-stone-400">
          {t.dashSchedule.noSchedule}
        </div>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                {weekDates.map((d, i) => (
                  <th key={i} className="px-3 py-2 text-center font-medium text-stone-500">
                    <p>{t.common.weekDaysShort[i]}</p>
                    <p className="text-xs text-stone-400">{d.getDate()}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weekDates.map((d, i) => {
                  const shift = myShiftProps.find(
                    (s) => new Date(s.date).toDateString() === d.toDateString()
                  );
                  return (
                    <td key={i} className="px-3 py-4 text-center align-top border-t border-stone-100">
                      {shift ? (
                        <div className="rounded bg-stone-100 text-stone-900 px-2 py-1.5 text-xs font-medium space-y-0.5">
                          <p className="font-mono">{shift.startTime}–{shift.endTime}</p>
                          <p className="text-stone-500 font-normal truncate">{shift.locationName}</p>
                          {isThisWeek && <SwapButton myShift={shift} colleagueShifts={colleagueShifts} />}
                        </div>
                      ) : (
                        <span className="text-stone-400 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {isThisWeek && incomingSwapProps.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-700">Incoming swap requests</h2>
          {incomingSwapProps.map((sw) => (
            <IncomingSwapCard key={sw.id} swap={sw} />
          ))}
        </div>
      )}
    </div>
  );
}
