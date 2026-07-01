"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";

interface Props {
  companyId: string;
  openEntry: { id: string; clockIn: string } | null;
  locations: { id: string; name: string }[];
  defaultLocationId: string | null;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ClockControls({ companyId, openEntry, locations, defaultLocationId }: Props) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(defaultLocationId ?? locations[0]?.id ?? "");

  const [adjusting, setAdjusting] = useState(false);
  const [adjustedClockIn, setAdjustedClockIn] = useState(openEntry ? toLocalDatetimeValue(openEntry.clockIn) : "");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const [customClockOut, setCustomClockOut] = useState(false);
  const [clockOutTime, setClockOutTime] = useState(toLocalDatetimeValue(new Date().toISOString()));

  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(todayDate());
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("17:00");
  const [manualNote, setManualNote] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    if (!openEntry) return;
    const since = new Date(openEntry.clockIn);
    function tick() {
      const ms = Date.now() - since.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setElapsed(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  async function clockIn() {
    setLoading(true);
    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, locationId: selectedLocation || undefined }),
    });
    setLoading(false);
    router.refresh();
  }

  async function clockOut() {
    if (!openEntry) return;
    setLoading(true);
    const clockOutISO = customClockOut ? new Date(clockOutTime).toISOString() : new Date().toISOString();
    await fetch(`/api/time-entries/${openEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clockOut: clockOutISO, notes }),
    });
    setLoading(false);
    setNotes("");
    setCustomClockOut(false);
    router.refresh();
  }

  async function saveAdjustedClockIn() {
    if (!openEntry) return;
    setAdjustSaving(true);
    await fetch(`/api/time-entries/${openEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clockIn: new Date(adjustedClockIn).toISOString() }),
    });
    setAdjustSaving(false);
    setAdjusting(false);
    router.refresh();
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setManualError("");
    const clockInVal = `${manualDate}T${manualStart}:00`;
    const clockOutVal = `${manualDate}T${manualEnd}:00`;
    if (new Date(clockOutVal) <= new Date(clockInVal)) {
      setManualError(t.hours.endAfterStart);
      return;
    }
    setManualSaving(true);
    const res = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        locationId: selectedLocation || undefined,
        clockIn: new Date(clockInVal).toISOString(),
        clockOut: new Date(clockOutVal).toISOString(),
        notes: manualNote || undefined,
      }),
    });
    setManualSaving(false);
    if (res.ok) {
      setShowManual(false);
      setManualNote("");
      router.refresh();
    } else {
      const d = await res.json();
      setManualError(d.error ?? t.hours.endAfterStart);
    }
  }

  if (openEntry) {
    const clockInTime = new Date(openEntry.clockIn).toLocaleTimeString(t.dateLocale, {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-green-800">{t.hours.currentlyClockedIn}</p>
            <p className="text-3xl font-mono font-bold text-green-900 mt-1 tabular-nums tracking-tight">
              {elapsed || "…"}
            </p>
            {adjusting ? (
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="datetime-local"
                  value={adjustedClockIn}
                  onChange={(e) => setAdjustedClockIn(e.target.value)}
                  className="rounded border border-green-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <button
                  onClick={saveAdjustedClockIn}
                  disabled={adjustSaving}
                  className="text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-50"
                >
                  {adjustSaving ? t.common.saving : t.common.save}
                </button>
                <button onClick={() => setAdjusting(false)} className="text-xs text-green-600 hover:text-green-800">
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAdjustedClockIn(toLocalDatetimeValue(openEntry.clockIn)); setAdjusting(true); }}
                className="text-xs text-green-700 mt-0.5 hover:underline"
              >
                {t.common.since} {clockInTime} · {t.hours.sinceSuffix}
              </button>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-200 px-2.5 py-1 text-xs font-medium text-green-800">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-green-800 mb-1">{t.hours.notesLabel}</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.hours.notesPlaceholder}
            className="w-full rounded border border-green-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div className="space-y-2">
          {customClockOut ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-green-800">{t.hours.clockOutTime}</label>
              <input
                type="datetime-local"
                value={clockOutTime}
                max={toLocalDatetimeValue(new Date().toISOString())}
                onChange={(e) => setClockOutTime(e.target.value)}
                className="rounded border border-green-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <button onClick={() => setCustomClockOut(false)} className="text-xs text-green-600 hover:text-green-800">
                {t.common.cancel}
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setClockOutTime(toLocalDatetimeValue(new Date().toISOString())); setCustomClockOut(true); }}
              className="text-xs text-green-700 hover:underline"
            >
              {t.hours.forgotClockOut}
            </button>
          )}
          <div>
            <button
              onClick={clockOut}
              disabled={loading}
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? t.hours.clockingOut : customClockOut ? t.hours.clockOutAt(clockOutTime.split("T")[1]) : t.hours.clockOut}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-stone-700">{t.hours.notClockedIn}</p>
            <p className="text-sm text-stone-400 mt-0.5">{t.hours.tapToStart}</p>
          </div>
          <button
            onClick={clockIn}
            disabled={loading}
            className="rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t.hours.starting : t.hours.clockIn}
          </button>
        </div>

        {locations.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">{t.hours.location}</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!showManual ? (
        <button
          onClick={() => setShowManual(true)}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          {t.hours.forgotClockIn}
        </button>
      ) : (
        <form onSubmit={submitManual} className="rounded-lg border border-stone-200 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-stone-800">{t.hours.logManually}</h3>
            <button type="button" onClick={() => { setShowManual(false); setManualError(""); }} className="text-xs text-stone-400 hover:text-stone-600">
              {t.common.cancel}
            </button>
          </div>
          <p className="text-xs text-stone-500">{t.hours.logDesc}</p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">{t.hours.dateLabel}</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                required
                max={todayDate()}
                className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">{t.hours.startTime}</label>
              <input
                type="time"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                required
                className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">{t.hours.endTime}</label>
              <input
                type="time"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                required
                className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          </div>

          {locations.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">{t.hours.location}</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="rounded border border-stone-300 px-2 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">{t.hours.notesLabel}</label>
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder={t.hours.notesPlaceholder}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>

          {manualError && <p className="text-sm text-red-500">{manualError}</p>}

          <button
            type="submit"
            disabled={manualSaving}
            className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {manualSaving ? t.hours.submitting : t.hours.submit}
          </button>
        </form>
      )}
    </div>
  );
}
