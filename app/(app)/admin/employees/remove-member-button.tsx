"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm(`Remove ${name} from the team? Their time entries and history will be kept.`)) return;
    setLoading(true);
    await fetch(`/api/admin/employees/${memberId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
    >
      {loading ? "Removing…" : "Remove"}
    </button>
  );
}
