"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Code {
  id: string;
  code: string;
  role: string;
  usedCount: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export function InviteCodeManager({ companyId, codes: initial }: { companyId: string; codes: Code[] }) {
  const router = useRouter();
  const [codes, setCodes] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [copied, setCopied] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this invite code?")) return;
    const res = await fetch(`/api/admin/invite-codes/${id}`, { method: "DELETE" });
    if (res.ok) setCodes((prev) => prev.filter((c) => c.id !== id));
  }

  async function create() {
    setCreating(true);
    const res = await fetch("/api/admin/invite-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, role }),
    });
    const data = await res.json();
    if (res.ok) {
      setCodes((prev) => [data, ...prev]);
    }
    setCreating(false);
    router.refresh();
  }

  function copy(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "EMPLOYEE" | "ADMIN")}
          className="rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="EMPLOYEE">Employee</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          onClick={create}
          disabled={creating}
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {creating ? "Generating…" : "Generate invite code"}
        </button>
      </div>

      {codes.length === 0 ? (
        <p className="text-sm text-stone-400">No invite codes yet</p>
      ) : (
        <div className="rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Code</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Role</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Uses</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Created</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {codes.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-base font-bold tracking-widest text-stone-900">{c.code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-stone-100 text-stone-600"
                    }`}>
                      {c.role.charAt(0) + c.role.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-stone-400 text-xs">
                    {new Date(c.createdAt).toLocaleDateString("lt-LT")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => copy(c.code)}
                        className="text-xs text-amber-700 hover:text-amber-900 font-medium"
                      >
                        {copied === c.code ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
