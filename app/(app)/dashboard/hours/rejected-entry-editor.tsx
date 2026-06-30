"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  entryId: string;
  clockIn: string;
  clockOut: string;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RejectedEntryEditor({ entryId, clockIn, clockOut }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editIn, setEditIn] = useState(toLocalDatetimeValue(clockIn));
  const [editOut, setEditOut] = useState(toLocalDatetimeValue(clockOut));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function resubmit() {
    setError("");
    if (new Date(editOut) <= new Date(editIn)) {
      setError("End time must be after start time");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/time-entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clockIn: new Date(editIn).toISOString(),
        clockOut: new Date(editOut).toISOString(),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to resubmit");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 hover:text-red-700 underline transition-colors"
      >
        Edit &amp; resubmit
      </button>
    );
  }

  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-stone-500 mb-0.5">Start</label>
          <input
            type="datetime-local"
            value={editIn}
            onChange={(e) => setEditIn(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-0.5">End</label>
          <input
            type="datetime-local"
            value={editOut}
            onChange={(e) => setEditOut(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={resubmit}
          disabled={saving}
          className="text-xs font-medium text-stone-700 hover:text-stone-900 disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Resubmit"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-stone-400 hover:text-stone-600">
          Cancel
        </button>
      </div>
    </div>
  );
}
