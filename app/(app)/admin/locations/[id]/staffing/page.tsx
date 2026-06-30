"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { StaffingQuickSetup } from "./staffing-quick-setup";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 – 23:00

interface Rule {
  dayOfWeek: number;
  hour: number;
  minStaff: number;
}

export default function StaffingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: locationId } = use(params);

  const [grid, setGrid] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"setup" | "grid">("setup");

  useEffect(() => {
    fetch(`/api/admin/staffing-rules/${locationId}`)
      .then((r) => r.json())
      .then((rules: Rule[]) => {
        const g: Record<string, number> = {};
        rules.forEach((r) => { g[`${r.dayOfWeek}_${r.hour}`] = r.minStaff; });
        setGrid(g);
        setLoading(false);
      });
  }, [locationId]);

  function setValue(day: number, hour: number, val: string) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setGrid((prev) => ({ ...prev, [`${day}_${hour}`]: num }));
    setSaved(false);
  }

  async function saveGrid() {
    setSaving(true);
    const rules: Rule[] = [];
    for (let day = 1; day <= 7; day++) {
      for (const hour of HOURS) {
        const val = grid[`${day}_${hour}`] ?? 0;
        if (val > 0) rules.push({ dayOfWeek: day, hour, minStaff: val });
      }
    }
    await fetch(`/api/admin/staffing-rules/${locationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    setSaving(false);
    setSaved(true);
  }

  function handleApplied(rules: Rule[]) {
    const g: Record<string, number> = {};
    rules.forEach((r) => { g[`${r.dayOfWeek}_${r.hour}`] = r.minStaff; });
    setGrid(g);
    setTab("grid");
  }

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin/locations" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
        ← Locations
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-stone-900">Staffing Requirements</h1>
        <p className="text-sm text-stone-500">Set when this location is open and how many staff are needed</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-stone-200">
        {(["setup", "grid"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-amber-500 text-amber-700"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {t === "setup" ? "Quick setup" : "Fine-tune grid"}
          </button>
        ))}
      </div>

      {tab === "setup" && (
        <StaffingQuickSetup locationId={locationId} onApplied={handleApplied} />
      )}

      {tab === "grid" && (
        <div className="space-y-4">
          <p className="text-xs text-stone-500">
            Edit individual hour slots. Amber cells are active requirements. Click Quick setup to regenerate from scratch.
          </p>

          {loading ? (
            <p className="text-stone-400 text-sm">Loading…</p>
          ) : (
            <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-x-auto">
              <table className="text-xs min-w-[700px]">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-stone-500 w-16">Hour</th>
                    {DAYS.map((d) => (
                      <th key={d} className="px-2 py-2 text-center font-medium text-stone-500 w-20">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="px-3 py-1.5 text-stone-500 font-mono tabular-nums">
                        {String(hour).padStart(2, "0")}:00
                      </td>
                      {DAYS.map((_, dayIdx) => {
                        const day = dayIdx + 1;
                        const val = grid[`${day}_${hour}`] ?? 0;
                        return (
                          <td key={day} className="px-2 py-1 text-center">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={val === 0 ? "" : val}
                              placeholder="–"
                              onChange={(e) => setValue(day, hour, e.target.value)}
                              className={`w-14 rounded border text-center text-xs px-1 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                                val > 0
                                  ? "border-amber-300 bg-amber-50 text-amber-900 font-medium"
                                  : "border-stone-200 text-stone-300"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={saveGrid}
              disabled={saving}
              className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
