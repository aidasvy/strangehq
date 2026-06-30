"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    if (!confirm("Cancel this request?")) return;
    setLoading(true);
    await fetch(`/api/holidays/${requestId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={cancel}
      disabled={loading}
      className="text-xs text-stone-400 hover:text-red-500 disabled:opacity-50 transition-colors"
    >
      {loading ? "…" : "Cancel"}
    </button>
  );
}
