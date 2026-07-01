"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  entryId: string;
  clockIn: string;
  clockOut: string | null;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimeEntryEditor({ entryId, clockIn, clockOut }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editIn, setEditIn] = useState(toLocalDatetimeValue(clockIn));
  const [editOut, setEditOut] = useState(clockOut ? toLocalDatetimeValue(clockOut) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (editOut && new Date(editOut) <= new Date(editIn)) {
      setError("Clock-out must be after clock-in");
      return;
    }
    setSaving(true);
    const body: Record<string, string> = { clockIn: new Date(editIn).toISOString() };
    if (editOut) body.clockOut = new Date(editOut).toISOString();
    const res = await fetch(`/api/time-entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
    }
  }

  async function deleteEntry() {
    if (!confirm("Delete this time entry? This cannot be undone.")) return;
    setError("");
    try {
      const res = await fetch(`/api/time-entries/${entryId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to delete");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to delete");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="space-y-2 min-w-[280px]">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-stone-500 mb-0.5">Clock in</label>
          <input
            type="datetime-local"
            value={editIn}
            onChange={(e) => setEditIn(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-0.5">Clock out</label>
          <input
            type="datetime-local"
            value={editOut}
            onChange={(e) => setEditOut(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-medium text-stone-700 hover:text-stone-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-stone-400 hover:text-stone-600">
          Cancel
        </button>
        <button onClick={deleteEntry} className="text-xs text-red-400 hover:text-red-600 ml-auto">
          Delete
        </button>
      </div>
    </div>
  );
}
