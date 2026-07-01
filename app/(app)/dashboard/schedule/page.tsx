import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "@/lib/i18n/translations";
import { SwapButton, IncomingSwapCard, ColleagueShift, MyShift, IncomingSwap } from "./swap-panel";

function getWeekStart(offset = 0): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

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

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backHome}</Link>
      <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-black">{t.dashSchedule.title}</h1>
      <p className="text-sm text-stone-500">
        {t.dashSchedule.weekOf} {weekStart.toLocaleDateString(t.dateLocale, { day: "numeric", month: "long", year: "numeric" })}
      </p>

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
                          <SwapButton myShift={shift} colleagueShifts={colleagueShifts} />
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

      {incomingSwapProps.length > 0 && (
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
