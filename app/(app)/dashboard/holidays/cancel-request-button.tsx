"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    if (!confirm(t.timeOff.cancelConfirm)) return;
    setLoading(true);
    const res = await fetch(`/api/holidays/${requestId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to cancel request");
      setLoading(false);
      return;
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={cancel}
      disabled={loading}
      className="text-xs text-stone-400 hover:text-red-500 disabled:opacity-50 transition-colors"
    >
      {loading ? "…" : t.timeOff.cancel}
    </button>
  );
}
