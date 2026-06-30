import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ScheduleBuilder } from "./schedule-builder";
import { RosterView } from "./roster-view";
import Link from "next/link";

function getWeekStart(offset = 0): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em - sh * 60 - sm) / 60;
  return diff > 0 ? diff : 0;
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; week?: string; view?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const companyId = membership.companyId;
  const { locationId: qLocationId, week, view } = await searchParams;
  const activeView = view === "roster" ? "roster" : "builder";

  const weekOffset = week ? parseInt(week, 10) : 1;
  const weekStart = getWeekStart(weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const locations = await db.location.findMany({
    where: { companyId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (locations.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-stone-900">Schedule Builder</h1>
        <p className="text-stone-500 text-sm">
          You need at least one location to build a schedule.{" "}
          <Link href="/admin/locations" className="text-amber-700 underline">
            Create a location →
          </Link>
        </p>
      </div>
    );
  }

  const activeLocationId =
    qLocationId && locations.find((l) => l.id === qLocationId)
      ? qLocationId
      : locations[0].id;

  const [schedule, employees, availabilities, monthlyApproved, monthlyShifts] = await Promise.all([
    db.schedule.findFirst({
      where: { locationId: activeLocationId, weekStart },
      include: {
        shifts: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { date: "asc" },
        },
      },
    }),
    db.companyMember.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    }),
    db.availability.findMany({
      where: { companyId, weekStart },
    }),
    db.timeEntry.findMany({
      where: {
        companyId,
        status: "APPROVED",
        clockIn: { gte: monthStart },
        clockOut: { lte: monthEnd, not: null },
      },
      select: { userId: true, clockIn: true, clockOut: true },
    }),
    db.scheduleShift.findMany({
      where: {
        schedule: { companyId },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { userId: true, startTime: true, endTime: true },
    }),
  ]);

  // Compute per-user monthly stats
  const approvedHoursByUser: Record<string, number> = {};
  monthlyApproved.forEach((e) => {
    if (!e.clockOut) return;
    approvedHoursByUser[e.userId] =
      (approvedHoursByUser[e.userId] ?? 0) +
      (e.clockOut.getTime() - e.clockIn.getTime()) / 3600000;
  });

  const scheduledHoursByUser: Record<string, number> = {};
  monthlyShifts.forEach((s) => {
    scheduledHoursByUser[s.userId] =
      (scheduledHoursByUser[s.userId] ?? 0) + shiftHours(s.startTime, s.endTime);
  });

  const employeeList = employees.map((m) => ({
    id: m.userId,
    memberId: m.id,
    name: m.user.name,
    email: m.user.email,
    phone: m.user.phone,
    role: m.role as "EMPLOYEE" | "MANAGER" | "ADMIN",
    availability: availabilities.find((a) => a.userId === m.userId)?.data ?? null,
    monthlyApprovedHours: Math.round((approvedHoursByUser[m.userId] ?? 0) * 10) / 10,
    monthlyScheduledHours: Math.round((scheduledHoursByUser[m.userId] ?? 0) * 10) / 10,
  }));

  const existingShifts = schedule?.shifts.map((s) => ({
    id: s.id,
    userId: s.userId,
    date: s.date.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
  })) ?? [];

  // All shifts for this week across all locations (published + draft from OTHER locations)
  const [allWeekShifts, crossLocationRaw] = await Promise.all([
    db.scheduleShift.findMany({
      where: {
        schedule: { companyId, status: "PUBLISHED" },
        date: { gte: weekStart, lte: weekEnd },
      },
      include: {
        schedule: { select: { location: { select: { name: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    // Cross-location: any shifts from other locations this week (draft or published)
    db.scheduleShift.findMany({
      where: {
        schedule: { companyId, locationId: { not: activeLocationId } },
        date: { gte: weekStart, lte: weekEnd },
      },
      include: {
        schedule: { select: { location: { select: { name: true } } } },
      },
    }),
  ]);

  const crossLocationShifts = crossLocationRaw.map((s) => ({
    userId: s.userId,
    date: s.date.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
    locationName: s.schedule.location.name,
  }));

  const rosterShifts = allWeekShifts.map((s) => ({
    userId: s.userId,
    date: s.date.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
    locationName: s.schedule.location.name,
  }));

  const weekLabels = ["This week", "Next week", "In 2 weeks", "In 3 weeks"];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Overview</Link>
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Schedule</h1>
          <p className="text-sm text-stone-500">
            Week of {weekStart.toLocaleDateString("lt-LT", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* View toggle */}
          <div className="flex rounded-lg border border-stone-200 overflow-hidden text-xs font-medium">
            <Link
              href={`/admin/schedule?locationId=${activeLocationId}&week=${weekOffset}&view=builder`}
              className={`px-3 py-1.5 transition-colors ${activeView === "builder" ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-50"}`}
            >
              Builder
            </Link>
            <Link
              href={`/admin/schedule?locationId=${activeLocationId}&week=${weekOffset}&view=roster`}
              className={`px-3 py-1.5 border-l border-stone-200 transition-colors ${activeView === "roster" ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-50"}`}
            >
              Roster
            </Link>
          </div>

          {/* Week selector */}
          <div className="flex gap-1 flex-wrap">
            {[0, 1, 2, 3].map((w) => (
              <Link
                key={w}
                href={`/admin/schedule?locationId=${activeLocationId}&week=${w}&view=${activeView}`}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  weekOffset === w
                    ? "bg-stone-800 text-white"
                    : "border border-stone-300 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {weekLabels[w]}
              </Link>
            ))}
          </div>

          {/* Location selector */}
          {locations.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {locations.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/admin/schedule?locationId=${loc.id}&week=${weekOffset}&view=${activeView}`}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    activeLocationId === loc.id
                      ? "bg-amber-600 text-white"
                      : "border border-stone-300 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {loc.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeView === "builder" ? (
        <ScheduleBuilder
          companyId={companyId}
          locationId={activeLocationId}
          locationName={locations.find((l) => l.id === activeLocationId)?.name ?? ""}
          weekStart={weekStart.toISOString()}
          scheduleId={schedule?.id ?? null}
          scheduleStatus={schedule?.status ?? null}
          employees={employeeList}
          existingShifts={existingShifts}
          crossLocationShifts={crossLocationShifts}
        />
      ) : (
        <RosterView
          weekStart={weekStart.toISOString()}
          employees={employeeList}
          shifts={rosterShifts}
        />
      )}
    </div>
  );
}
