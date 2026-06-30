"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AvailabilitySlot } from "./page";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Props {
  companyId: string;
  weekStart: string;
  weekLabel: string;
  existing: AvailabilitySlot[] | null;
}

export function AvailabilityForm({ companyId, weekStart, weekLabel, existing }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [slots, setSlots] = useState<(AvailabilitySlot | null)[]>(
    DAYS.map((_, i) => existing?.find((s) => s.day === i + 1) ?? null)
  );

  function toggle(i: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[i] = next[i] ? null : { day: i + 1, startTime: "09:00", endTime: "17:00" };
      return next;
    });
  }

  function update(i: number, field: "startTime" | "endTime", value: string) {
    setSlots((prev) => {
      const next = [...prev];
      if (next[i]) next[i] = { ...next[i]!, [field]: value };
      return next;
    });
  }

  async function save() {
    setSaving(true);
    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        weekStart,
        data: slots.filter(Boolean),
      }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-stone-700">{weekLabel}</p>
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm divide-y divide-stone-100">
        {DAYS.map((day, i) => {
          const slot = slots[i];
          return (
            <div key={day} className="flex items-center gap-4 px-4 py-3">
              <input
                type="checkbox"
                id={`day-${i}`}
                checked={!!slot}
                onChange={() => toggle(i)}
                className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400"
              />
              <label htmlFor={`day-${i}`} className="w-28 text-sm font-medium text-stone-700 cursor-pointer">
                {day}
              </label>
              {slot ? (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => update(i, "startTime", e.target.value)}
                    className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <span className="text-stone-400">to</span>
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => update(i, "endTime", e.target.value)}
                    className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              ) : (
                <span className="text-sm text-stone-400">Not available</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-stone-800 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save availability"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </div>
  );
}
