"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

const ROLE_BADGE: Record<Role, string> = {
  EMPLOYEE: "",
  MANAGER: "bg-blue-100 text-blue-700",
  ADMIN: "bg-purple-100 text-purple-700",
};

interface Employee {
  id: string;
  memberId: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: Role;
  availability: unknown;
  monthlyApprovedHours: number;
  monthlyScheduledHours: number;
}

interface Shift {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface Props {
  companyId: string;
  locationId: string;
  weekStart: string;
  scheduleId: string | null;
  scheduleStatus: string | null;
  employees: Employee[];
  existingShifts: Shift[];
}

function getAvailability(data: unknown, day: number): { startTime: string; endTime: string } | null {
  if (!Array.isArray(data)) return null;
  return data.find((s: { day: number }) => s.day === day) ?? null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function shiftHours(start: string, end: string): number {
  return Math.max(0, (timeToMinutes(end) - timeToMinutes(start)) / 60);
}

type CellStatus = "ok" | "no_avail" | "outside_window" | "none";

function getCellStatus(shift: { startTime: string; endTime: string } | undefined, avail: { startTime: string; endTime: string } | null, hasData: boolean): CellStatus {
  if (!shift) return "none";
  if (!hasData) return "no_avail";
  if (!avail) return "no_avail";
  const shiftStart = timeToMinutes(shift.startTime);
  const shiftEnd = timeToMinutes(shift.endTime);
  const availStart = timeToMinutes(avail.startTime);
  const availEnd = timeToMinutes(avail.endTime);
  if (shiftStart < availStart || shiftEnd > availEnd) return "outside_window";
  return "ok";
}

interface Warning {
  employeeName: string;
  message: string;
  severity: "error" | "warn";
}

export function ScheduleBuilder({ companyId, locationId, weekStart, scheduleId, scheduleStatus, employees, existingShifts }: Props) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Omit<Shift, "id">[]>(
    existingShifts.map(({ id: _id, ...s }) => s)
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function addShift(userId: string, date: Date) {
    const already = shifts.find(
      (s) => s.userId === userId && new Date(s.date).toDateString() === date.toDateString()
    );
    if (already) return;
    const avail = getAvailability(employees.find((e) => e.id === userId)?.availability, date.getDay() === 0 ? 7 : date.getDay());
    setShifts((prev) => [
      ...prev,
      { userId, date: date.toISOString(), startTime: avail?.startTime ?? "09:00", endTime: avail?.endTime ?? "17:00" },
    ]);
  }

  function removeShift(userId: string, date: Date) {
    setShifts((prev) =>
      prev.filter((s) => !(s.userId === userId && new Date(s.date).toDateString() === date.toDateString()))
    );
  }

  function updateShift(userId: string, date: Date, field: "startTime" | "endTime", value: string) {
    setShifts((prev) =>
      prev.map((s) =>
        s.userId === userId && new Date(s.date).toDateString() === date.toDateString()
          ? { ...s, [field]: value }
          : s
      )
    );
  }

  async function save() {
    setSaving(true);
    await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, locationId, weekStart, shifts }),
    });
    setSaving(false);
    router.refresh();
  }

  async function publish() {
    setPublishing(true);
    if (scheduleId) {
      await fetch(`/api/schedule/${scheduleId}/publish`, { method: "POST" });
    }
    setPublishing(false);
    router.refresh();
  }

  // Compute per-employee week hours from current shifts state
  const weekHoursByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    shifts.forEach((s) => {
      map[s.userId] = (map[s.userId] ?? 0) + shiftHours(s.startTime, s.endTime);
    });
    return map;
  }, [shifts]);

  // Compute warnings
  const warnings = useMemo<Warning[]>(() => {
    const result: Warning[] = [];
    employees.forEach((emp) => {
      const hasAvailData = Array.isArray(emp.availability) && (emp.availability as unknown[]).length > 0;
      const empShifts = shifts.filter((s) => s.userId === emp.id);
      const name = emp.name ?? emp.email;

      if (empShifts.length > 0 && !hasAvailData) {
        result.push({ employeeName: name, message: "No availability submitted for this week", severity: "warn" });
      }

      empShifts.forEach((s) => {
        const date = new Date(s.date);
        const dayIndex = date.getDay() === 0 ? 7 : date.getDay();
        const avail = getAvailability(emp.availability, dayIndex);
        const dayName = DAYS[dayIndex - 1];

        if (!avail && hasAvailData) {
          result.push({ employeeName: name, message: `Scheduled on ${dayName} but marked unavailable`, severity: "error" });
        } else if (avail) {
          const shiftStart = timeToMinutes(s.startTime);
          const shiftEnd = timeToMinutes(s.endTime);
          const availStart = timeToMinutes(avail.startTime);
          const availEnd = timeToMinutes(avail.endTime);
          if (shiftStart < availStart || shiftEnd > availEnd) {
            result.push({
              employeeName: name,
              message: `${dayName} shift ${s.startTime}–${s.endTime} is outside availability ${avail.startTime}–${avail.endTime}`,
              severity: "warn",
            });
          }
        }

        const h = shiftHours(s.startTime, s.endTime);
        if (h > 8) {
          result.push({ employeeName: name, message: `${dayName} shift is ${h.toFixed(1)}h (over 8h)`, severity: "warn" });
        }
      });

      const weekH = weekHoursByEmployee[emp.id] ?? 0;
      if (weekH > 40) {
        result.push({ employeeName: name, message: `Scheduled ${weekH.toFixed(1)}h this week (over 40h)`, severity: "error" });
      }
    });
    return result;
  }, [employees, shifts, weekHoursByEmployee]);

  const errors = warnings.filter((w) => w.severity === "error");
  const warns = warnings.filter((w) => w.severity === "warn");

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex gap-3 items-center flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
        {scheduleId && scheduleStatus !== "PUBLISHED" && (
          <button
            onClick={publish}
            disabled={publishing || errors.length > 0}
            title={errors.length > 0 ? "Fix errors before publishing" : undefined}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {publishing ? "Publishing…" : "Publish schedule"}
          </button>
        )}
        {scheduleStatus === "PUBLISHED" && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Published — employees can see this
          </span>
        )}
      </div>

      {/* Warnings panel */}
      {warnings.length > 0 && (
        <div className={`rounded-lg border px-4 py-3 space-y-1 ${errors.length > 0 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <button
            onClick={() => setShowWarnings((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium w-full text-left"
          >
            <span>{errors.length > 0 ? "🔴" : "🟡"}</span>
            <span className={errors.length > 0 ? "text-red-700" : "text-amber-700"}>
              {errors.length} error{errors.length !== 1 ? "s" : ""}, {warns.length} warning{warns.length !== 1 ? "s" : ""}
            </span>
            <span className="ml-auto text-stone-400 text-xs">{showWarnings ? "hide" : "show"}</span>
          </button>
          {showWarnings && (
            <ul className="space-y-0.5 mt-2">
              {warnings.map((w, i) => (
                <li key={i} className={`text-xs flex gap-2 ${w.severity === "error" ? "text-red-700" : "text-amber-700"}`}>
                  <span className="font-medium shrink-0">{w.employeeName}:</span>
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Schedule grid */}
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-stone-500 w-44">Employee</th>
              {weekDates.map((d, i) => (
                <th key={i} className="px-2 py-2 text-center font-medium text-stone-500 min-w-[110px]">
                  <p>{DAYS[i]}</p>
                  <p className="text-xs font-normal text-stone-400">{d.getDate()}/{d.getMonth() + 1}</p>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-stone-500 w-20">Week hrs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {employees.map((emp) => {
              const hasAvailData = Array.isArray(emp.availability) && (emp.availability as unknown[]).length > 0;
              const weekH = weekHoursByEmployee[emp.id] ?? 0;

              return (
                <tr key={emp.id}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5 leading-tight">
                      <p className="font-medium text-stone-800 text-sm">{emp.name ?? "—"}</p>
                      {emp.role !== "EMPLOYEE" && (
                        <span className={`inline-flex rounded-full px-1.5 py-0 text-xs font-medium ${ROLE_BADGE[emp.role]}`}>
                          {emp.role === "MANAGER" ? "Mgr" : "Admin"}
                        </span>
                      )}
                    </div>
                    {emp.phone && (
                      <a href={`tel:${emp.phone}`} className="text-xs text-stone-400 hover:text-stone-600 block leading-tight mt-0.5">
                        {emp.phone}
                      </a>
                    )}
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-stone-400" title="Approved hours this calendar month">
                        ✓ {emp.monthlyApprovedHours}h
                      </span>
                      <span className="text-xs text-stone-300">·</span>
                      <span className="text-xs text-stone-400" title="Scheduled hours this calendar month">
                        📅 {emp.monthlyScheduledHours}h
                      </span>
                    </div>
                  </td>

                  {weekDates.map((d, i) => {
                    const dayNum = i + 1; // 1=Mon … 7=Sun
                    const shift = shifts.find(
                      (s) => s.userId === emp.id && new Date(s.date).toDateString() === d.toDateString()
                    );
                    const avail = getAvailability(emp.availability, dayNum);
                    const status = getCellStatus(shift, avail, hasAvailData);

                    const cellBg =
                      status === "no_avail" ? "bg-red-50" :
                      status === "outside_window" ? "bg-amber-50" :
                      "bg-transparent";

                    return (
                      <td key={i} className={`px-2 py-2 align-top ${cellBg}`}>
                        {shift ? (
                          <div className="space-y-1">
                            <input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) => updateShift(emp.id, d, "startTime", e.target.value)}
                              className="w-full rounded border border-stone-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) => updateShift(emp.id, d, "endTime", e.target.value)}
                              className="w-full rounded border border-stone-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-stone-400">
                                {shiftHours(shift.startTime, shift.endTime).toFixed(1)}h
                              </span>
                              <button
                                onClick={() => removeShift(emp.id, d)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                ✕
                              </button>
                            </div>
                            {status === "no_avail" && hasAvailData && (
                              <p className="text-xs text-red-500">Unavailable</p>
                            )}
                            {status === "outside_window" && avail && (
                              <p className="text-xs text-amber-600">{avail.startTime}–{avail.endTime}</p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => addShift(emp.id, d)}
                            className={`w-full rounded py-1.5 text-xs border border-dashed transition-colors ${
                              avail
                                ? "border-green-300 text-green-600 hover:bg-green-50"
                                : "border-stone-200 text-stone-300 hover:bg-stone-50 hover:text-stone-500"
                            }`}
                          >
                            {avail ? `${avail.startTime}–${avail.endTime}` : "+ Add"}
                          </button>
                        )}
                      </td>
                    );
                  })}

                  <td className={`px-3 py-2 text-right align-top text-xs font-semibold tabular-nums ${
                    weekH > 40 ? "text-red-600" : weekH > 32 ? "text-amber-600" : "text-stone-600"
                  }`}>
                    {weekH > 0 ? `${weekH.toFixed(1)}h` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-stone-400 flex flex-wrap gap-4">
        <span><span className="inline-block w-3 h-3 rounded bg-green-50 border border-green-300 mr-1" />Green = within availability</span>
        <span><span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-200 mr-1" />Amber = outside time window</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200 mr-1" />Red = unavailable / not submitted</span>
        <span>✓ = approved hrs this month · 📅 = scheduled hrs this month</span>
      </div>
    </div>
  );
}
