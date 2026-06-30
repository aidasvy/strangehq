"use client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

const ROLE_BADGE: Record<Role, string> = {
  EMPLOYEE: "",
  MANAGER: "bg-blue-100 text-blue-700",
  ADMIN: "bg-purple-100 text-purple-700",
};

interface Employee {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: Role;
  monthlyApprovedHours: number;
  monthlyScheduledHours: number;
}

interface RosterShift {
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  locationName: string;
}

interface Props {
  weekStart: string;
  employees: Employee[];
  shifts: RosterShift[];
}

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

export function RosterView({ weekStart, employees, shifts }: Props) {
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  if (shifts.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-8 text-center text-sm text-stone-400">
        No published shifts for this week. Publish a schedule to see the roster.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Day-by-day roster */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {weekDates.map((date, dayIdx) => {
          const dateStr = date.toDateString();
          const dayShifts = shifts.filter((s) => new Date(s.date).toDateString() === dateStr);
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <div
              key={dayIdx}
              className={`rounded-lg border bg-white shadow-sm overflow-hidden ${isToday ? "border-amber-300" : "border-stone-200"}`}
            >
              <div className={`px-3 py-2 border-b ${isToday ? "bg-amber-50 border-amber-200" : "bg-stone-50 border-stone-100"}`}>
                <p className={`text-sm font-semibold ${isToday ? "text-amber-800" : "text-stone-700"}`}>
                  {DAYS[dayIdx]}
                  {isToday && <span className="ml-1.5 text-xs font-normal text-amber-600">Today</span>}
                </p>
                <p className="text-xs text-stone-400">
                  {date.toLocaleDateString("lt-LT", { day: "numeric", month: "short" })}
                </p>
              </div>

              {dayShifts.length === 0 ? (
                <p className="px-3 py-3 text-xs text-stone-300">No shifts</p>
              ) : (
                <ul className="divide-y divide-stone-50">
                  {dayShifts.map((s, i) => {
                    const emp = employeeMap[s.userId];
                    if (!emp) return null;
                    return (
                      <li key={i} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-stone-800 truncate">
                                {emp.name ?? emp.email}
                              </p>
                              {emp.role !== "EMPLOYEE" && (
                                <span className={`shrink-0 inline-flex rounded-full px-1.5 py-0 text-xs font-medium ${ROLE_BADGE[emp.role]}`}>
                                  {emp.role === "MANAGER" ? "Mgr" : "Admin"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-amber-700 font-medium">
                              {s.startTime}–{s.endTime}
                              <span className="text-stone-400 font-normal ml-1">
                                ({shiftHours(s.startTime, s.endTime).toFixed(1)}h)
                              </span>
                            </p>
                            {shifts.some((x) => x.userId !== s.userId && x.locationName !== s.locationName) && (
                              <p className="text-xs text-stone-400">{s.locationName}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {emp.phone && (
                            <a
                              href={`tel:${emp.phone}`}
                              className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-0.5"
                            >
                              📞 {emp.phone}
                            </a>
                          )}
                          <a
                            href={`mailto:${emp.email}`}
                            className="text-xs text-stone-400 hover:text-stone-600 truncate"
                          >
                            ✉ {emp.email}
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {dayShifts.length > 0 && (
                <div className="px-3 py-1.5 bg-stone-50 border-t border-stone-100">
                  <p className="text-xs text-stone-400">
                    {dayShifts.length} working ·{" "}
                    {dayShifts.reduce((s, sh) => s + shiftHours(sh.startTime, sh.endTime), 0).toFixed(1)}h total
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monthly hours summary */}
      <div>
        <h2 className="text-base font-semibold text-stone-900 mb-3">Team — this month</h2>

        {/* Mobile: cards */}
        <div className="sm:hidden space-y-2">
          {employees.map((emp) => {
            const gap = emp.monthlyScheduledHours - emp.monthlyApprovedHours;
            return (
              <div key={emp.id} className="rounded-lg border border-stone-200 bg-white shadow-sm px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-medium text-stone-800 text-sm">{emp.name ?? "—"}</span>
                  {emp.role !== "EMPLOYEE" && (
                    <span className={`inline-flex rounded-full px-1.5 py-0 text-xs font-medium ${ROLE_BADGE[emp.role]}`}>
                      {emp.role === "MANAGER" ? "Mgr" : "Admin"}
                    </span>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-stone-500 mb-1.5">
                  <span>Approved: <strong className="text-stone-700">{emp.monthlyApprovedHours}h</strong></span>
                  <span>Scheduled: <strong className="text-stone-700">{emp.monthlyScheduledHours}h</strong></span>
                  <span className={`font-semibold ${gap > 0 ? "text-amber-600" : gap < 0 ? "text-red-500" : "text-stone-400"}`}>
                    {gap > 0 ? `+${gap.toFixed(1)}h` : gap < 0 ? `${gap.toFixed(1)}h` : "On track"}
                  </span>
                </div>
                <div className="flex gap-3 text-xs">
                  {emp.phone && <a href={`tel:${emp.phone}`} className="text-stone-500">📞 {emp.phone}</a>}
                  <a href={`mailto:${emp.email}`} className="text-stone-400">✉ {emp.email}</a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Employee</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Contact</th>
                <th className="px-4 py-2 text-right font-medium text-stone-500">Approved hrs</th>
                <th className="px-4 py-2 text-right font-medium text-stone-500">Scheduled hrs</th>
                <th className="px-4 py-2 text-right font-medium text-stone-500">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {employees.map((emp) => {
                const gap = emp.monthlyScheduledHours - emp.monthlyApprovedHours;
                return (
                  <tr key={emp.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-stone-800">{emp.name ?? "—"}</span>
                        {emp.role !== "EMPLOYEE" && (
                          <span className={`inline-flex rounded-full px-1.5 py-0 text-xs font-medium ${ROLE_BADGE[emp.role]}`}>
                            {emp.role === "MANAGER" ? "Manager" : "Admin"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {emp.phone && <a href={`tel:${emp.phone}`} className="block text-xs text-stone-500 hover:text-stone-800">📞 {emp.phone}</a>}
                        <a href={`mailto:${emp.email}`} className="block text-xs text-stone-400 hover:text-stone-600">✉ {emp.email}</a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone-700">{emp.monthlyApprovedHours}h</td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone-700">{emp.monthlyScheduledHours}h</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${gap > 0 ? "text-amber-600" : gap < 0 ? "text-red-500" : "text-stone-400"}`}>
                      {gap > 0 ? `+${gap.toFixed(1)}h` : gap < 0 ? `${gap.toFixed(1)}h` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-stone-400 mt-2">Gap = scheduled − approved. Positive = more shifts than hours clocked.</p>
      </div>
    </div>
  );
}
