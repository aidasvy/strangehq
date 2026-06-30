import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ApproveRejectButtons } from "./approve-reject-buttons";
import Link from "next/link";
import { TimeEntryEditor } from "./time-entry-editor";
import { ManualEntryForm } from "./manual-entry-form";
import { BulkApproveButton } from "./bulk-approve-button";

export default async function TimeEntriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const [entries, members] = await Promise.all([
    db.timeEntry.findMany({
      where: { companyId: membership.companyId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { clockIn: "desc" },
      take: 100,
    }),
    db.companyMember.findMany({
      where: { companyId: membership.companyId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const employees = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
  }));

  const activeEntries = entries.filter((e) => !e.clockOut);
  const staleEntries = activeEntries.filter((e) => Date.now() - e.clockIn.getTime() > 12 * 3600000);
  const pendingIds = entries.filter((e) => e.status === "PENDING" && e.clockOut).map((e) => e.id);

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Overview</Link>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Time Entries</h1>
          {activeEntries.length > 0 && (
            <p className="text-sm text-green-700 mt-0.5">
              {activeEntries.length} {activeEntries.length === 1 ? "person" : "people"} currently clocked in
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BulkApproveButton pendingIds={pendingIds} />
          <a
            href="/api/admin/export/time-entries"
            download
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 shadow-sm transition-colors"
          >
            Export CSV
          </a>
          <ManualEntryForm companyId={membership.companyId} employees={employees} />
        </div>
      </div>

      {staleEntries.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800">Stale clock-ins</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {staleEntries.map((e) => e.user.name ?? e.user.email).join(", ")} {staleEntries.length === 1 ? "has" : "have"} been clocked in for over 12 hours — they may have forgotten to clock out.
            </p>
          </div>
        </div>
      )}

      {activeEntries.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">Currently working</p>
          <div className="flex flex-wrap gap-2">
            {activeEntries.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                {e.user.name ?? e.user.email} · since {e.clockIn.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        {entries.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">No time entries yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Employee</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Date</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Clock in</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Clock out</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Hours</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Status</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {entries.map((e) => {
                const hours = e.clockOut
                  ? ((e.clockOut.getTime() - e.clockIn.getTime()) / 3600000).toFixed(2)
                  : "—";
                return (
                  <tr key={e.id} className="hover:bg-stone-50 transition-colors align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{e.user.name ?? "—"}</p>
                      <p className="text-xs text-stone-400">{e.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {e.clockIn.toLocaleDateString("lt-LT")}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{fmt(e.clockIn)}</td>
                    <td className="px-4 py-3">{e.clockOut ? fmt(e.clockOut) : <span className="text-green-600">Active</span>}</td>
                    <td className="px-4 py-3 text-stone-700">{hours}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3 space-y-2">
                      {e.status === "PENDING" && e.clockOut && (
                        <ApproveRejectButtons entryId={e.id} />
                      )}
                      <TimeEntryEditor
                        entryId={e.id}
                        clockIn={e.clockIn.toISOString()}
                        clockOut={e.clockOut?.toISOString() ?? null}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmt(d: Date) {
  return d.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-green-50 text-green-700",
    REJECTED: "bg-red-50 text-red-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
