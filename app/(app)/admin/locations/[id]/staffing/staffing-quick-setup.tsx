"use client";

import { useState, useEffect } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS_ALL = Array.from({ length: 18 }, (_, i) => i + 6); // 06–23

interface DayHours {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface PeakPeriod {
  from: string;
  to: string;
  extra: number;
}

const DEFAULT_HOURS: DayHours[] = DAYS.map((_, i) => ({
  isOpen: i < 5,
  openTime: "09:00",
  closeTime: "22:00",
}));

function timeToHour(t: string) {
  return parseInt(t.split(":")[0], 10);
}

interface Props {
  locationId: string;
  onApplied: (rules: { dayOfWeek: number; hour: number; minStaff: number }[]) => void;
}

export function StaffingQuickSetup({ locationId, onApplied }: Props) {
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [baseStaff, setBaseStaff] = useState(2);
  const [peaks, setPeaks] = useState<PeakPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/locations/${locationId}/hours`)
      .then((r) => r.json())
      .then((data: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[]) => {
        if (data.length === 7) {
          const sorted = [...data].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
          setHours(sorted.map((d) => ({ isOpen: d.isOpen, openTime: d.openTime, closeTime: d.closeTime })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [locationId]);

  function updateDay(i: number, patch: Partial<DayHours>) {
    setHours((prev) => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
    setSaved(false);
  }

  function addPeak() {
    setPeaks((prev) => [...prev, { from: "12:00", to: "14:00", extra: 1 }]);
  }

  function updatePeak(i: number, patch: Partial<PeakPeriod>) {
    setPeaks((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
    setSaved(false);
  }

  function removePeak(i: number) {
    setPeaks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function copyWeekdaysToWeekend() {
    setHours((prev) => prev.map((d, i) => i >= 5 ? { ...d, isOpen: prev[0].isOpen, openTime: prev[0].openTime, closeTime: prev[0].closeTime } : d));
  }

  async function apply() {
    setSaving(true);

    // Save location hours
    await fetch(`/api/admin/locations/${locationId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hours: hours.map((d, i) => ({ dayOfWeek: i + 1, ...d })),
      }),
    });

    // Generate staffing rules from hours + peaks
    const rules: { dayOfWeek: number; hour: number; minStaff: number }[] = [];
    hours.forEach((day, i) => {
      if (!day.isOpen) return;
      const openH = timeToHour(day.openTime);
      const closeH = timeToHour(day.closeTime);
      for (const h of HOURS_ALL) {
        if (h < openH || h >= closeH) continue;
        let staff = baseStaff;
        peaks.forEach((p) => {
          const fromH = timeToHour(p.from);
          const toH = timeToHour(p.to);
          if (h >= fromH && h < toH) staff += p.extra;
        });
        rules.push({ dayOfWeek: i + 1, hour: h, minStaff: staff });
      }
    });

    // Save staffing rules
    await fetch(`/api/admin/staffing-rules/${locationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });

    setSaving(false);
    setSaved(true);
    onApplied(rules);
  }

  if (loading) return <p className="text-sm text-stone-400">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Operating hours */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-800">Operating hours</h3>
          <button
            type="button"
            onClick={copyWeekdaysToWeekend}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Copy weekday hours to weekend
          </button>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm divide-y divide-stone-100">
          {DAYS.map((day, i) => (
            <div key={day} className="flex items-center gap-3 px-4 py-2.5">
              <input
                type="checkbox"
                checked={hours[i].isOpen}
                onChange={(e) => updateDay(i, { isOpen: e.target.checked })}
                className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400"
              />
              <span className="w-24 text-sm font-medium text-stone-700">{day}</span>
              {hours[i].isOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={hours[i].openTime}
                    onChange={(e) => updateDay(i, { openTime: e.target.value })}
                    className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <span className="text-stone-400 text-sm">–</span>
                  <input
                    type="time"
                    value={hours[i].closeTime}
                    onChange={(e) => updateDay(i, { closeTime: e.target.value })}
                    className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              ) : (
                <span className="text-sm text-stone-400 italic">Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Base staffing */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-stone-800">Staffing levels</h3>
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm text-stone-700 w-48">Base staff during open hours</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBaseStaff((v) => Math.max(1, v - 1))}
                className="w-8 h-8 rounded border border-stone-300 text-stone-600 hover:bg-stone-50 font-medium text-lg leading-none flex items-center justify-center"
              >−</button>
              <span className="w-8 text-center font-semibold text-stone-900">{baseStaff}</span>
              <button
                type="button"
                onClick={() => setBaseStaff((v) => v + 1)}
                className="w-8 h-8 rounded border border-stone-300 text-stone-600 hover:bg-stone-50 font-medium text-lg leading-none flex items-center justify-center"
              >+</button>
            </div>
          </div>

          {/* Peak periods */}
          {peaks.map((p, i) => (
            <div key={i} className="flex items-center gap-3 pl-0 border-t border-stone-100 pt-3">
              <label className="text-sm text-stone-600 w-28 shrink-0">Rush period {i + 1}</label>
              <input
                type="time"
                value={p.from}
                onChange={(e) => updatePeak(i, { from: e.target.value })}
                className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <span className="text-stone-400 text-sm">–</span>
              <input
                type="time"
                value={p.to}
                onChange={(e) => updatePeak(i, { to: e.target.value })}
                className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <span className="text-sm text-stone-500">+</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updatePeak(i, { extra: Math.max(1, p.extra - 1) })}
                  className="w-7 h-7 rounded border border-stone-300 text-stone-600 hover:bg-stone-50 font-medium flex items-center justify-center text-sm"
                >−</button>
                <span className="w-6 text-center text-sm font-semibold">{p.extra}</span>
                <button
                  type="button"
                  onClick={() => updatePeak(i, { extra: p.extra + 1 })}
                  className="w-7 h-7 rounded border border-stone-300 text-stone-600 hover:bg-stone-50 font-medium flex items-center justify-center text-sm"
                >+</button>
              </div>
              <span className="text-xs text-stone-400">extra = {baseStaff + p.extra} total</span>
              <button
                type="button"
                onClick={() => removePeak(i)}
                className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors"
              >Remove</button>
            </div>
          ))}

          {peaks.length < 3 && (
            <button
              type="button"
              onClick={addPeak}
              className="text-xs text-stone-700 hover:text-stone-900 font-medium transition-colors"
            >
              + Add rush period (e.g. lunch, dinner)
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={apply}
          disabled={saving}
          className="rounded-lg bg-stone-800 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Applying…" : "Apply to staffing grid"}
        </button>
        {saved && <span className="text-sm text-green-600">Applied! Fine-tune below if needed.</span>}
      </div>
    </div>
  );
}
