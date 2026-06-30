"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EmployeeRateEditor({ memberId, currentRate }: { memberId: string; currentRate: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState(currentRate);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/employees/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hourlyRate: parseFloat(rate) }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          step="0.01"
          min="0"
          className="w-24 rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-stone-400 hover:text-stone-600">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm text-stone-700 hover:text-stone-900 hover:underline"
    >
      {currentRate ? `€${parseFloat(currentRate).toFixed(2)}` : "Set rate"}
    </button>
  );
}
