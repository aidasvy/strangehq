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

interface CrossShift {
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  locationName: string;
}

interface Props {
  companyId: string;
  locationId: string;
  locationName: string;
  weekStart: string;
  scheduleId: string | null;
  scheduleStatus: string | null;
  employees: Employee[];
  existingShifts: Shift[];
  crossLocationShifts: CrossShift[];
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

type CellStatus = "ok" | "no_avail" | "outside_window" | "cross_location" | "none";

function getCellStatus(
  shift: { startTime: string; endTime: string } | undefined,
  avail: { startTime: string; endTime: string } | null,
  hasData: boolean,
  hasCrossShift: boolean
): CellStatus {
  if (!shift) return "none";
  if (hasCrossShift) return "cross_location";
  if (!hasData) return "no_avail";
  if (!avail) return "no_avail";
  const ss = timeToMinutes(shift.startTime), se = timeToMinutes(shift.endTime);
  const as = timeToMinutes(avail.startTime), ae = timeToMinutes(avail.endTime);
  if (ss < as || se > ae) return "outside_window";
  return "ok";
}

interface Warning { employeeName: string; message: string; severity: "error" | "warn" }

export function ScheduleBuilder({
  companyId, locationId, locationName, weekStart, scheduleId, scheduleStatus,
  employees, existingShifts, crossLocationShifts,
}: Props) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Omit<Shift, "id">[]>(
    existingShifts.map(({ id: _id, ...s }) => s)
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [activeMobileDay, setActiveMobileDay] = useState<number>(() => {
    // Default to today if in the current week, else Monday
    const today = new Date();
    const ws = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      if (d.toDateString() === today.toDateString()) return i;
    }
    return 0;
  });

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
    const dayNum = date.getDay() === 0 ? 7 : date.getDay();
    const avail = getAvailability(employees.find((e) => e.id === userId)?.availability, dayNum);
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

  async function suggestSchedule() {
    setSuggesting(true);
    try {
      const res = await fetch("/api/admin/schedule/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          locationId,
          locationName,
          weekStart,
          employees: employees.map((e) => ({
            id: e.id,
            name: e.name ?? e.email,
            availability: e.availability,
            monthlyApprovedHours: e.monthlyApprovedHours,
            monthlyScheduledHours: e.monthlyScheduledHours,
          })),
          existingShifts: shifts,
          crossLocationShifts,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to generate suggestion");
        return;
      }
      const { shifts: suggested } = await res.json();
      if (Array.isArray(suggested) && suggested.length > 0) {
        setShifts(suggested);
      }
    } finally {
      setSuggesting(false);
    }
  }

  const weekHoursByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    shifts.forEach((s) => {
      map[s.userId] = (map[s.userId] ?? 0) + shiftHours(s.startTime, s.endTime);
    });
    return map;
  }, [shifts]);

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

        // Cross-location conflict
        const crossShift = crossLocationShifts.find(
          (cs) => cs.userId === emp.id && new Date(cs.date).toDateString() === date.toDateString()
        );
        if (crossShift) {
          const myStart = timeToMinutes(s.startTime);
          const myEnd = timeToMinutes(s.endTime);
          const csStart = timeToMinutes(crossShift.startTime);
          const csEnd = timeToMinutes(crossShift.endTime);
          if (myStart < csEnd && myEnd > csStart) {
            result.push({
              employeeName: name,
              message: `${dayName}: overlaps with shift at ${crossShift.locationName} (${crossShift.startTime}–${crossShift.endTime})`,
              severity: "error",
            });
          }
        }

        if (!avail && hasAvailData) {
          result.push({ employeeName: name, message: `Scheduled on ${dayName} but marked unavailable`, severity: "error" });
        } else if (avail) {
          const ss = timeToMinutes(s.startTime), se = timeToMinutes(s.endTime);
          const as = timeToMinutes(avail.startTime), ae = timeToMinutes(avail.endTime);
          if (ss < as || se > ae) {
            result.push({ employeeName: name, message: `${dayName} shift ${s.startTime}–${s.endTime} outside availability ${avail.startTime}–${avail.endTime}`, severity: "warn" });
          }
        }

        if (shiftHours(s.startTime, s.endTime) > 8) {
          result.push({ employeeName: name, message: `${dayName} shift over 8h`, severity: "warn" });
        }
      });

      const weekH = weekHoursByEmployee[emp.id] ?? 0;
      if (weekH > 40) {
        result.push({ employeeName: name, message: `${weekH.toFixed(1)}h this week (over 40h)`, severity: "error" });
      }
    });
    return result;
  }, [employees, shifts, weekHoursByEmployee, crossLocationShifts]);

  const errors = warnings.filter((w) => w.severity === "error");
  const warns = warnings.filter((w) => w.severity === "warn");

  // Render a single shift cell (shared between desktop and mobile)
  function ShiftCell({ emp, date, dayNum }: { emp: Employee; date: Date; dayNum: number }) {
    const hasAvailData = Array.isArray(emp.availability) && (emp.availability as unknown[]).length > 0;
    const shift = shifts.find((s) => s.userId === emp.id && new Date(s.date).toDateString() === date.toDateString());
    const avail = getAvailability(emp.availability, dayNum);
    const crossShift = crossLocationShifts.find(
      (cs) => cs.userId === emp.id && new Date(cs.date).toDateString() === date.toDateString()
    );
    const status = getCellStatus(shift, avail, hasAvailData, !!crossShift);

    const cellBg =
      status === "cross_location" ? "bg-purple-50" :
      status === "no_avail" ? "bg-red-50" :
      status === "outside_window" ? "bg-amber-50" :
      "bg-transparent";

    if (shift) {
      return (
        <div className={`space-y-1 rounded-lg p-1.5 ${cellBg}`}>
          <input
            type="time"
            value={shift.startTime}
            onChange={(e) => updateShift(emp.id, date, "startTime", e.target.value)}
            className="w-full rounded border border-stone-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <input
            type="time"
            value={shift.endTime}
            onChange={(e) => updateShift(emp.id, date, "endTime", e.target.value)}
            className="w-full rounded border border-stone-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-400">{shiftHours(shift.startTime, shift.endTime).toFixed(1)}h</span>
            <button onClick={() => removeShift(emp.id, date)} className="text-xs text-red-400 hover:text-red-600">✕</button>
          </div>
          {status === "cross_location" && crossShift && (
            <p className="text-xs text-purple-600 truncate">Also at {crossShift.locationName}</p>
          )}
          {status === "no_avail" && hasAvailData && <p className="text-xs text-red-500">Unavailable</p>}
          {status === "outside_window" && avail && <p className="text-xs text-amber-600">{avail.startTime}–{avail.endTime}</p>}
        </div>
      );
    }

    return (
      <button
        onClick={() => addShift(emp.id, date)}
        className={`w-full rounded py-1.5 text-xs border border-dashed transition-colors ${
          crossShift
            ? "border-purple-200 text-purple-400 hover:bg-purple-50"
            : avail
            ? "border-green-300 text-green-600 hover:bg-green-50"
            : "border-stone-200 text-stone-300 hover:bg-stone-50 hover:text-stone-500"
        }`}
      >
        {crossShift
          ? `${crossShift.locationName.slice(0, 10)}`
          : avail
          ? `${avail.startTime}–${avail.endTime}`
          : "+ Add"}
      </button>
    );
  }

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
        <button
          onClick={suggestSchedule}
          disabled={suggesting}
          title="Let AI build an optimal schedule based on availability and hours"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <span>{suggesting ? "✨ Thinking…" : "✨ Suggest schedule"}</span>
        </button>
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

      {/* ── MOBILE VIEW ──────────────────────────────────────────── */}
      <div className="lg:hidden space-y-3">
        {/* Day selector */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {weekDates.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            const dayShiftCount = shifts.filter((s) => new Date(s.date).toDateString() === d.toDateString()).length;
            return (
              <button
                key={i}
                onClick={() => setActiveMobileDay(i)}
                className={`flex-shrink-0 rounded-xl px-3 py-2 text-center transition-colors min-w-[60px] ${
                  activeMobileDay === i
                    ? "bg-stone-800 text-white"
                    : isToday
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                <p className="text-xs font-semibold">{DAYS[i]}</p>
                <p className="text-xs opacity-70">{d.getDate()}/{d.getMonth() + 1}</p>
                {dayShiftCount > 0 && (
                  <p className="text-xs font-bold mt-0.5">{dayShiftCount}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Employee cards for selected day */}
        <div className="space-y-2">
          {employees.map((emp) => {
            const date = weekDates[activeMobileDay];
            const dayNum = activeMobileDay + 1;
            const shift = shifts.find((s) => s.userId === emp.id && new Date(s.date).toDateString() === date.toDateString());
            const weekH = weekHoursByEmployee[emp.id] ?? 0;

            return (
              <div key={emp.id} className="rounded-lg border border-stone-200 bg-white shadow-sm p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-stone-800 text-sm">{emp.name ?? "—"}</p>
                      {emp.role !== "EMPLOYEE" && (
                        <span className={`inline-flex rounded-full px-1.5 py-0 text-xs font-medium ${ROLE_BADGE[emp.role]}`}>
                          {emp.role === "MANAGER" ? "Mgr" : "Admin"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400">
                      {weekH > 0 ? `${weekH.toFixed(1)}h this week` : "No shifts yet"}
                      {weekH > 40 && <span className="text-red-500 ml-1">⚠ over 40h</span>}
                    </p>
                  </div>
                  {shift ? (
                    <span className="text-xs text-amber-700 font-medium shrink-0">{shift.startTime}–{shift.endTime}</span>
                  ) : (
                    <span className="text-xs text-stone-300 shrink-0">No shift</span>
                  )}
                </div>
                <ShiftCell emp={emp} date={date} dayNum={dayNum} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP TABLE VIEW ────────────────────────────────────── */}
      <div className="hidden lg:block rounded-lg border border-stone-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-stone-500 w-44">Employee</th>
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <th key={i} className={`px-2 py-2 text-center font-medium min-w-[110px] ${isToday ? "text-amber-600" : "text-stone-500"}`}>
                    <p>{DAYS[i]}</p>
                    <p className="text-xs font-normal opacity-70">{d.getDate()}/{d.getMonth() + 1}</p>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right font-medium text-stone-500 w-20">Week hrs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {employees.map((emp) => {
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
                      <a href={`tel:${emp.phone}`} className="text-xs text-stone-400 hover:text-stone-600 block leading-tight mt-0.5">{emp.phone}</a>
                    )}
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-stone-400" title="Approved hours this calendar month">✓ {emp.monthlyApprovedHours}h</span>
                      <span className="text-xs text-stone-300">·</span>
                      <span className="text-xs text-stone-400" title="Scheduled hours this calendar month">📅 {emp.monthlyScheduledHours}h</span>
                    </div>
                  </td>

                  {weekDates.map((d, i) => (
                    <td key={i} className="px-2 py-2 align-top">
                      <ShiftCell emp={emp} date={d} dayNum={i + 1} />
                    </td>
                  ))}

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

      <div className="text-xs text-stone-400 flex flex-wrap gap-3">
        <span><span className="inline-block w-3 h-3 rounded bg-green-50 border border-green-300 mr-1" />Within availability</span>
        <span><span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-200 mr-1" />Outside time window</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200 mr-1" />Unavailable / not submitted</span>
        <span><span className="inline-block w-3 h-3 rounded bg-purple-50 border border-purple-200 mr-1" />Also at another location</span>
      </div>
    </div>
  );
}
