"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";

interface Balance {
  entitlement: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

interface Props {
  companyId: string;
  balance: Balance;
}

function countWeekdays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export function HolidayRequestForm({ companyId, balance }: Props) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<"PAID" | "UNPAID">("PAID");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [previewDays, setPreviewDays] = useState(0);

  useEffect(() => {
    setPreviewDays(countWeekdays(startDate, endDate));
  }, [startDate, endDate]);

  const willExceed = type === "PAID" && previewDays > balance.remainingDays;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        startDate,
        endDate,
        reason: form.get("reason"),
        type,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t.timeOff.submit);
      setLoading(false);
      return;
    }
    setStartDate("");
    setEndDate("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-4">
      <h2 className="font-semibold text-sm text-stone-900 mb-4">{t.timeOff.requestTitle}</h2>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1.5">{t.common.type}</label>
          <div className="flex rounded-lg border border-stone-200 overflow-hidden w-fit text-xs font-medium">
            <button
              type="button"
              onClick={() => setType("PAID")}
              className={`px-4 py-1.5 transition-colors ${type === "PAID" ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-50"}`}
            >
              {t.timeOff.paidLeave}
            </button>
            <button
              type="button"
              onClick={() => setType("UNPAID")}
              className={`px-4 py-1.5 border-l border-stone-200 transition-colors ${type === "UNPAID" ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-50"}`}
            >
              {t.timeOff.unpaid}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">{t.timeOff.from}</label>
            <input
              type="date"
              value={startDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">{t.timeOff.to}</label>
            <input
              type="date"
              value={endDate}
              min={startDate || new Date().toISOString().slice(0, 10)}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>
        </div>

        {previewDays > 0 && (
          <div className={`rounded-lg px-3 py-2 text-sm ${willExceed ? "bg-red-50 border border-red-200" : "bg-stone-50 border border-stone-200"}`}>
            <span className={`font-medium ${willExceed ? "text-red-700" : "text-stone-700"}`}>
              {t.common.workingDays(previewDays)}
            </span>
            {type === "PAID" && (
              <span className={`ml-2 text-xs ${willExceed ? "text-red-500" : "text-stone-400"}`}>
                {willExceed
                  ? t.timeOff.exceeds(balance.remainingDays)
                  : t.timeOff.remainingAfter(balance.remainingDays - previewDays)}
              </span>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">{t.timeOff.reasonOptional}</label>
          <input
            type="text"
            name="reason"
            placeholder="e.g. Family trip"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-stone-800 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {loading ? t.timeOff.submitting : t.timeOff.submit}
        </button>
      </form>
    </div>
  );
}
