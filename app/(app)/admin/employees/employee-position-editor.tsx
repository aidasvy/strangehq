"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EmployeePositionEditor({ memberId, currentPosition }: { memberId: string; currentPosition: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentPosition ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/employees/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: value.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          placeholder="e.g. Barista"
          autoFocus
          className="w-32 rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <button onClick={save} disabled={saving} className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50">
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => { setEditing(false); setError(""); }} className="text-xs text-stone-400 hover:text-stone-600">
          Cancel
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-sm text-stone-500 hover:text-stone-900 hover:underline text-left">
      {currentPosition ?? <span className="text-stone-400">—</span>}
    </button>
  );
}
