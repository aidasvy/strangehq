"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HolidayRequestForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        startDate: form.get("startDate"),
        endDate: form.get("endDate"),
        reason: form.get("reason"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to submit request");
      setLoading(false);
      return;
    }
    (e.target as HTMLFormElement).reset();
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-4">
      <h2 className="font-semibold text-sm text-stone-900 mb-4">Request holiday</h2>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">From</label>
            <input
              type="date"
              name="startDate"
              required
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">To</label>
            <input
              type="date"
              name="endDate"
              required
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Reason (optional)</label>
          <input
            type="text"
            name="reason"
            placeholder="e.g. Family trip"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-stone-800 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
