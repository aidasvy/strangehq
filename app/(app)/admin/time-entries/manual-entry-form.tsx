"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Employee {
  id: string;
  userId: string;
  name: string | null;
  email: string;
}

interface Props {
  companyId: string;
  employees: Employee[];
}

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ManualEntryForm({ companyId, employees }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState(employees[0]?.userId ?? "");
  const [date, setDate] = useState(todayDate());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const clockIn = new Date(`${date}T${start}:00`);
    const clockOut = new Date(`${date}T${end}:00`);
    if (clockOut <= clockIn) {
      setError("End time must be after start time");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        targetUserId,
        clockIn: clockIn.toISOString(),
        clockOut: clockOut.toISOString(),
        notes: notes || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setNotes("");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to create entry");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
      >
        + Add manual entry
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-stone-200 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-stone-800">Add manual time entry</h3>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="text-xs text-stone-400 hover:text-stone-600">
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Employee</label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            required
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {employees.map((emp) => (
              <option key={emp.userId} value={emp.userId}>
                {emp.name ?? emp.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            max={todayDate()}
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Start time</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">End time</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Employee forgot to clock in"
          className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Creating…" : "Create entry"}
      </button>
    </form>
  );
}
