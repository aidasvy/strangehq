import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SwapActions } from "./swap-actions";

function fmtShift(date: Date, startTime: string, endTime: string, location: string) {
  const day = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${startTime}–${endTime} @ ${location}`;
}

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function fmtHours(h: number): string {
  return `${h.toFixed(1)}h`;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING_TARGET: "bg-amber-50 text-amber-700 border-amber-200",
    PENDING_ADMIN: "bg-blue-50 text-blue-700 border-blue-200",
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    REJECTED: "bg-stone-100 text-stone-500 border-stone-200",
  };
  const labels: Record<string, string> = {
    PENDING_TARGET: "Awaiting colleague",
    PENDING_ADMIN: "Needs approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[status] ?? "bg-stone-100 text-stone-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

// Swaps trade whole shifts, not hours — a 2h shift for an 8h shift changes both
// people's pay for the week. Flag it clearly instead of leaving admins to notice by eye.
const IMBALANCE_THRESHOLD_HOURS = 1;

export default async function SwapRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership || (membership.role !== "ADMIN" && membership.role !== "MANAGER")) {
    redirect("/dashboard");
  }

  const swaps = await db.shiftSwapRequest.findMany({
    where: { companyId: membership.companyId },
    include: {
      requester: { select: { name: true } },
      targetUser: { select: { name: true } },
      requesterShift: { include: { schedule: { select: { location: { select: { name: true } } } } } },
      targetShift: { include: { schedule: { select: { location: { select: { name: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const pending = swaps.filter((s) => s.status === "PENDING_ADMIN");
  const others = swaps.filter((s) => s.status !== "PENDING_ADMIN");

  // Batch-fetch each week's shifts for everyone involved in a pending swap, so we
  // can show "this trade changes their week from Xh to Yh" instead of just the
  // two shifts in isolation.
  const userWeeks = pending.flatMap((s) => [
    { userId: s.requesterId, week: getMonday(s.requesterShift.date) },
    { userId: s.targetUserId, week: getMonday(s.targetShift.date) },
  ]);
  const weekTimes = userWeeks.map((w) => w.week.getTime());
  let weekShifts: { userId: string; date: Date; startTime: string; endTime: string }[] = [];
  if (weekTimes.length > 0) {
    const rangeStart = new Date(Math.min(...weekTimes));
    const rangeEnd = new Date(Math.max(...weekTimes) + 7 * 86400000 - 1);
    weekShifts = await db.scheduleShift.findMany({
      where: {
        userId: { in: [...new Set(userWeeks.map((w) => w.userId))] },
        schedule: { companyId: membership.companyId },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { userId: true, date: true, startTime: true, endTime: true },
    });
  }

  function weeklyHoursFor(userId: string, weekStart: Date): number {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekShifts
      .filter((s) => s.userId === userId && s.date >= weekStart && s.date <= weekEnd)
      .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime), 0);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Overview</Link>
      <div>
        <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-black">Shift swaps</h1>
        <p className="text-sm text-stone-500 mt-0.5">Review and approve swap requests between employees.</p>
      </div>

      {swaps.length === 0 && (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-8 text-center text-sm text-stone-400">
          No swap requests yet.
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Needs your approval</h2>
          {pending.map((sw) => {
            const reqShiftH = shiftHours(sw.requesterShift.startTime, sw.requesterShift.endTime);
            const tgtShiftH = shiftHours(sw.targetShift.startTime, sw.targetShift.endTime);
            const hourDiff = Math.abs(reqShiftH - tgtShiftH);
            const imbalanced = hourDiff >= IMBALANCE_THRESHOLD_HOURS;

            const reqWeekStart = getMonday(sw.requesterShift.date);
            const tgtWeekStart = getMonday(sw.targetShift.date);
            const reqCurrentWeekly = weeklyHoursFor(sw.requesterId, reqWeekStart);
            const tgtCurrentWeekly = weeklyHoursFor(sw.targetUserId, tgtWeekStart);
            const reqAfterWeekly = reqCurrentWeekly - reqShiftH + tgtShiftH;
            const tgtAfterWeekly = tgtCurrentWeekly - tgtShiftH + reqShiftH;

            return (
              <div key={sw.id} className="rounded-lg border border-stone-200 bg-white shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 break-words">
                      {sw.requester.name} ↔ {sw.targetUser.name}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Requested {sw.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="shrink-0">{statusBadge(sw.status)}</div>
                </div>

                {imbalanced && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <svg className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs text-amber-800">
                      Uneven trade — {fmtHours(reqShiftH)} for {fmtHours(tgtShiftH)} (Δ {fmtHours(hourDiff)}). This changes both people&apos;s hours for the week.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md bg-stone-50 p-3 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-stone-400">{sw.requester.name} takes</p>
                      <span className="shrink-0 font-mono font-semibold text-stone-600">{fmtHours(tgtShiftH)}</span>
                    </div>
                    <p className="font-medium text-stone-800 break-words">{fmtShift(sw.targetShift.date, sw.targetShift.startTime, sw.targetShift.endTime, sw.targetShift.schedule.location.name)}</p>
                  </div>
                  <div className="rounded-md bg-stone-50 p-3 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-stone-400">{sw.targetUser.name} takes</p>
                      <span className="shrink-0 font-mono font-semibold text-stone-600">{fmtHours(reqShiftH)}</span>
                    </div>
                    <p className="font-medium text-stone-800 break-words">{fmtShift(sw.requesterShift.date, sw.requesterShift.startTime, sw.requesterShift.endTime, sw.requesterShift.schedule.location.name)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-stone-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">{sw.requester.name}&apos;s week</span>
                    <span className="font-mono">
                      {fmtHours(reqCurrentWeekly)} → <span className={reqAfterWeekly > 40 ? "text-amber-600 font-semibold" : "font-semibold text-stone-700"}>{fmtHours(reqAfterWeekly)}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">{sw.targetUser.name}&apos;s week</span>
                    <span className="font-mono">
                      {fmtHours(tgtCurrentWeekly)} → <span className={tgtAfterWeekly > 40 ? "text-amber-600 font-semibold" : "font-semibold text-stone-700"}>{fmtHours(tgtAfterWeekly)}</span>
                    </span>
                  </div>
                </div>

                <SwapActions swapId={sw.id} />
              </div>
            );
          })}
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">History</h2>
          <div className="rounded-lg border border-stone-200 bg-white shadow-sm divide-y divide-stone-100">
            {others.map((sw) => (
              <div key={sw.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800">
                    {sw.requester.name} ↔ {sw.targetUser.name}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5 break-words">
                    {fmtShift(sw.requesterShift.date, sw.requesterShift.startTime, sw.requesterShift.endTime, sw.requesterShift.schedule.location.name)} →{" "}
                    {fmtShift(sw.targetShift.date, sw.targetShift.startTime, sw.targetShift.endTime, sw.targetShift.schedule.location.name)}
                  </p>
                </div>
                <div className="shrink-0">{statusBadge(sw.status)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
