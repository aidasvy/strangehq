import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

  const weekStart = getWeekStart();

  const schedules = await db.schedule.findMany({
    where: {
      companyId: membership.companyId,
      weekStart,
      status: "PUBLISHED",
    },
    include: {
      location: { select: { name: true } },
      shifts: {
        where: { userId: session.user.id },
        orderBy: { date: "asc" },
      },
    },
  });

  // Flatten shifts with their location name
  const myShifts = schedules.flatMap((s) =>
    s.shifts.map((shift) => ({ ...shift, locationName: s.location.name }))
  );

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Home</Link>
      <h1 className="text-2xl font-bold text-stone-900">My Schedule</h1>
      <p className="text-sm text-stone-500">
        Week of {weekStart.toLocaleDateString("lt-LT", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      {myShifts.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-6 text-center text-sm text-stone-400">
          No published schedule for this week yet. Check back later.
        </div>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                {weekDates.map((d, i) => (
                  <th key={i} className="px-3 py-2 text-center font-medium text-stone-500">
                    <p>{DAYS[i]}</p>
                    <p className="text-xs text-stone-400">{d.getDate()}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weekDates.map((d, i) => {
                  const shift = myShifts.find(
                    (s) => new Date(s.date).toDateString() === d.toDateString()
                  );
                  return (
                    <td key={i} className="px-3 py-4 text-center align-top border-t border-stone-100">
                      {shift ? (
                        <div className="rounded bg-stone-100 text-stone-900 px-2 py-1.5 text-xs font-medium space-y-0.5">
                          <p>{shift.startTime}–{shift.endTime}</p>
                          <p className="text-stone-500 font-normal truncate">{shift.locationName}</p>
                        </div>
                      ) : (
                        <span className="text-stone-300 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
