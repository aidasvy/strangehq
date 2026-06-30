"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HolidayApproveButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function update(status: "APPROVED" | "REJECTED") {
    setLoading(true);
    await fetch(`/api/holidays/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => update("APPROVED")}
        disabled={loading}
        className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
      >
        Approve
      </button>
      <button
        onClick={() => update("REJECTED")}
        disabled={loading}
        className="rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
      >
        Reject
      </button>
    </div>
  );
}
