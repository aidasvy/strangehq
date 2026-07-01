"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";

export function EmployeeStartDateEditor({
  memberId,
  currentDate,
}: {
  memberId: string;
  currentDate: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(currentDate ?? "");
  const [saving, setSaving] = useState(false);
  const { t } = useLocale();

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/employees/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employmentStartDate: date || null }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
        >
          {saving ? "…" : t.common.save}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-stone-400 hover:text-stone-600">
          {t.common.cancel}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-sm hover:underline ${currentDate ? "text-stone-700 hover:text-stone-900" : "text-amber-600 hover:text-amber-800 font-medium"}`}
    >
      {currentDate ? new Date(currentDate).toLocaleDateString(t.dateLocale) : t.adminEmployees.notSet}
    </button>
  );
}
