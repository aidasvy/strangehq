"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";

export function HolidayApproveButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { t } = useLocale();

  async function update(status: "APPROVED" | "REJECTED") {
    setLoading(true);
    const res = await fetch(`/api/holidays/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? t.adminHolidays.updateFailed);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => update("APPROVED")}
        disabled={loading}
        className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
      >
        {t.adminHolidays.approve}
      </button>
      <button
        onClick={() => update("REJECTED")}
        disabled={loading}
        className="rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
      >
        {t.adminHolidays.reject}
      </button>
    </div>
  );
}
