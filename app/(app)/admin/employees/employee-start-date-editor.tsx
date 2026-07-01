"use client";

import { useState, useEffect, useRef } from "react";
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
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(currentDate ?? "");
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/employees/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employmentStartDate: date || null }),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => { setDate(currentDate ?? ""); setOpen((v) => !v); }}
        className={`text-sm hover:underline ${currentDate ? "text-stone-700 hover:text-stone-900" : "text-amber-600 hover:text-amber-800 font-medium"}`}
      >
        {currentDate ? new Date(currentDate).toLocaleDateString(t.dateLocale) : t.adminEmployees.notSet}
      </button>

      {open && (
        <div
          ref={modalRef}
          className="fixed z-50 bg-white border border-stone-200 rounded-xl shadow-xl p-4 w-72"
          style={{
            // Position relative to trigger, but clamp to viewport
            top: (() => {
              if (!triggerRef.current) return 0;
              const rect = triggerRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              return spaceBelow > 160 ? rect.bottom + 6 : rect.top - 166;
            })(),
            left: (() => {
              if (!triggerRef.current) return 0;
              const rect = triggerRef.current.getBoundingClientRect();
              return Math.min(rect.left, window.innerWidth - 296);
            })(),
          }}
        >
          <p className="text-xs font-semibold text-stone-500 mb-3">{t.adminEmployees.employmentStart}</p>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 mb-2"
            autoFocus
          />
          <button
            onClick={() => setDate(today)}
            className="w-full text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-md py-1.5 mb-3 hover:bg-stone-50 transition-colors"
          >
            Today ({today})
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-stone-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-stone-800 disabled:opacity-40 transition-colors"
            >
              {saving ? "…" : t.common.save}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
