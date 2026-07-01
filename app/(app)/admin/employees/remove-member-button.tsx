"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!confirm(`Remove ${name} from the team? Their time entries and history will be kept.`)) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/employees/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to remove");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to remove");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={remove}
        disabled={loading}
        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
      >
        {loading ? "Removing…" : "Remove"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
