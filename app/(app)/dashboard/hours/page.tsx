import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ClockControls } from "./clock-controls";
import { RejectedEntryEditor } from "./rejected-entry-editor";
import Link from "next/link";

export default async function HoursPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const userId = session.user.id;

  const membership = await db.companyMember.findFirst({ where: { userId } });
  if (!membership) redirect("/onboarding");

  const [openEntry, recentEntries, locations] = await Promise.all([
    db.timeEntry.findFirst({ where: { userId, clockOut: null } }),
    db.timeEntry.findMany({
      where: { userId },
      orderBy: { clockIn: "desc" },
      take: 20,
    }),
    db.location.findMany({
      where: { companyId: membership.companyId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Home</Link>
      <h1 className="text-2xl font-bold text-stone-900">Hours</h1>

      <div className="max-w-2xl">
        <ClockControls
          companyId={membership.companyId}
          openEntry={openEntry ? { id: openEntry.id, clockIn: openEntry.clockIn.toISOString() } : null}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          defaultLocationId={openEntry?.locationId ?? locations[0]?.id ?? null}
        />
      </div>

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-sm text-stone-900">Recent entries</h2>
        </div>
        {recentEntries.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">No time entries yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Date</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Clock in</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Clock out</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Hours</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recentEntries.map((entry) => {
                const hours = entry.clockOut
                  ? ((entry.clockOut.getTime() - entry.clockIn.getTime()) / 3600000).toFixed(2)
                  : "—";
                return (
                  <tr key={entry.id} className="hover:bg-stone-50 transition-colors align-top">
                    <td className="px-4 py-3 text-stone-600">
                      {entry.clockIn.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{fmt(entry.clockIn)}</td>
                    <td className="px-4 py-3">{entry.clockOut ? fmt(entry.clockOut) : <span className="text-green-600 font-medium">Active</span>}</td>
                    <td className="px-4 py-3 text-stone-700">{hours}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                      {entry.status === "REJECTED" && entry.clockOut && (
                        <RejectedEntryEditor
                          entryId={entry.id}
                          clockIn={entry.clockIn.toISOString()}
                          clockOut={entry.clockOut.toISOString()}
                        />
                      )}
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
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
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
