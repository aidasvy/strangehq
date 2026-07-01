"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SwapActions({ swapId }: { swapId: string }) {
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function act(action: "approve" | "deny") {
    setLoading(action);
    const res = await fetch(`/api/shift-swaps/${swapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to update swap request");
      setLoading(null);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) return <span className="text-xs text-stone-400">Done</span>;

  return (
    <div className="flex gap-2">
      <button
        onClick={() => act("deny")}
        disabled={!!loading}
        className="rounded-md border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors"
      >
        {loading === "deny" ? "…" : "Deny"}
      </button>
      <button
        onClick={() => act("approve")}
        disabled={!!loading}
        className="rounded-md bg-stone-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-stone-800 disabled:opacity-40 transition-colors"
      >
        {loading === "approve" ? "…" : "Approve"}
      </button>
    </div>
  );
}
