"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";

export function BulkApproveButton({ pendingIds }: { pendingIds: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { t } = useLocale();

  if (pendingIds.length === 0) return null;

  async function approveAll() {
    setLoading(true);
    const res = await fetch("/api/time-entries/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: pendingIds, status: "APPROVED" }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? t.adminTimeEntries.approveFailed(pendingIds.length));
    }
    router.refresh();
  }

  return (
    <button
      onClick={approveAll}
      disabled={loading}
      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
    >
      {loading ? t.adminTimeEntries.approving : t.adminTimeEntries.approveAll(pendingIds.length)}
    </button>
  );
}
