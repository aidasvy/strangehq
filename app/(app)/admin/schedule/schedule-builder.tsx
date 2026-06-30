"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Employee {
  id: string;
  name: string | null;
  availability: unknown;
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

export function ScheduleBuilder({ companyId, locationId, weekStart, scheduleId, scheduleStatus, employees, existingShifts }: Props) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Omit<Shift, "id">[]>(
    existingShifts.map(({ id: _id, ...s }) => s)
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
    setShifts((prev) => [...prev, { userId, date: date.toISOString(), startTime: "09:00", endTime: "17:00" }]);
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

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
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
            disabled={publishing}
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

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-stone-500 w-36">Employee</th>
              {weekDates.map((d, i) => (
                <th key={i} className="px-2 py-2 text-center font-medium text-stone-500 min-w-[110px]">
                  <p>{DAYS[i]}</p>
                  <p className="text-xs font-normal text-stone-400">{d.getDate()}/{d.getMonth() + 1}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="px-3 py-2 font-medium text-sm text-stone-700 align-top">
                  {emp.name ?? "—"}
                </td>
                {weekDates.map((d, i) => {
                  const shift = shifts.find(
                    (s) => s.userId === emp.id && new Date(s.date).toDateString() === d.toDateString()
                  );
                  const avail = getAvailability(emp.availability, i + 1);

                  return (
                    <td key={i} className="px-2 py-2 align-top">
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
                          <button
                            onClick={() => removeShift(emp.id, d)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Remove
                          </button>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        Green cells show employee availability for that day. Click to add a shift.
      </p>
    </div>
  );
}

function getAvailability(data: unknown, day: number): { startTime: string; endTime: string } | null {
  if (!Array.isArray(data)) return null;
  return data.find((s: { day: number }) => s.day === day) ?? null;
}
