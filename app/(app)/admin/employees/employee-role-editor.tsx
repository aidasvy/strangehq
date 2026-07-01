"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

interface Props {
  memberId: string;
  currentRole: Role;
  isSelf: boolean;
}

const ROLE_STYLES: Record<Role, string> = {
  EMPLOYEE: "bg-stone-100 text-stone-600",
  MANAGER: "bg-blue-100 text-blue-700",
  ADMIN: "bg-purple-100 text-purple-700",
};

const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

export function EmployeeRoleEditor({ memberId, currentRole, isSelf }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Admins can't be demoted via this UI; self can't change own role
  const canEdit = !isSelf && currentRole !== "ADMIN";

  async function setRole(role: Role) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/employees/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const badge = (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[currentRole]}`}>
      {ROLE_LABEL[currentRole]}
    </span>
  );

  if (!canEdit) return badge;

  if (open) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {badge}
        <span className="text-stone-300 text-xs">→</span>
        {currentRole !== "MANAGER" && (
          <button
            onClick={() => setRole("MANAGER")}
            disabled={saving}
            className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            Promote to Manager
          </button>
        )}
        {currentRole === "MANAGER" && (
          <button
            onClick={() => setRole("EMPLOYEE")}
            disabled={saving}
            className="rounded-full px-2 py-0.5 text-xs font-medium bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 disabled:opacity-50 transition-colors"
          >
            Demote to Employee
          </button>
        )}
        <button
          onClick={() => { setOpen(false); setError(""); }}
          className="text-xs text-stone-400 hover:text-stone-600"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <button onClick={() => setOpen(true)} className="group flex items-center gap-1.5">
      {badge}
      <span className="text-xs text-stone-300 group-hover:text-stone-500 transition-colors">edit</span>
    </button>
  );
}
