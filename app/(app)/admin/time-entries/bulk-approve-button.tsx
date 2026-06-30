"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BulkApproveButton({ pendingIds }: { pendingIds: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (pendingIds.length === 0) return null;

  async function approveAll() {
    setLoading(true);
    await Promise.all(
      pendingIds.map((id) =>
        fetch(`/api/time-entries/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "APPROVED" }),
        })
      )
    );
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={approveAll}
      disabled={loading}
      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
    >
      {loading ? "Approving…" : `Approve all (${pendingIds.length})`}
    </button>
  );
}
