import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ScheduleBuilder } from "./schedule-builder";
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

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const companyId = membership.companyId;
  const { locationId: qLocationId, week } = await searchParams;

  const weekOffset = week ? parseInt(week, 10) : 1;
  const weekStart = getWeekStart(weekOffset);

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

  const activeLocationId = qLocationId && locations.find((l) => l.id === qLocationId)
    ? qLocationId
    : locations[0].id;

  const [schedule, employees, availabilities] = await Promise.all([
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
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.availability.findMany({
      where: { companyId, weekStart },
    }),
  ]);

  const employeeList = employees.map((m) => ({
    id: m.userId,
    name: m.user.name ?? m.user.email,
    availability: availabilities.find((a) => a.userId === m.userId)?.data ?? null,
  }));

  const existingShifts = schedule?.shifts.map((s) => ({
    id: s.id,
    userId: s.userId,
    date: s.date.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
  })) ?? [];

  const weekLabels = ["This week", "Next week", "In 2 weeks", "In 3 weeks"];

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Overview</Link>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Schedule Builder</h1>
          <p className="text-sm text-stone-500">
            Week of {weekStart.toLocaleDateString("lt-LT", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* Week selector */}
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((w) => (
              <Link
                key={w}
                href={`/admin/schedule?locationId=${activeLocationId}&week=${w}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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
            <div className="flex gap-1">
              {locations.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/admin/schedule?locationId=${loc.id}&week=${weekOffset}`}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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

      <ScheduleBuilder
        companyId={companyId}
        locationId={activeLocationId}
        weekStart={weekStart.toISOString()}
        scheduleId={schedule?.id ?? null}
        scheduleStatus={schedule?.status ?? null}
        employees={employeeList}
        existingShifts={existingShifts}
      />
    </div>
  );
}
