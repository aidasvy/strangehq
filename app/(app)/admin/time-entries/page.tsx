import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ApproveRejectButtons } from "./approve-reject-buttons";
import Link from "next/link";
import { TimeEntryEditor } from "./time-entry-editor";
import { ManualEntryForm } from "./manual-entry-form";
import { BulkApproveButton } from "./bulk-approve-button";
import { cookies } from "next/headers";
import { getTranslations, type Translations } from "@/lib/i18n/translations";

export default async function TimeEntriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

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
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backOverview}</Link>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{t.adminTimeEntries.title}</h1>
          {activeEntries.length > 0 && (
            <p className="text-sm text-green-700 mt-0.5">
              {t.adminTimeEntries.currentlyClocked(activeEntries.length)}
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
            {t.common.exportCsv}
          </a>
          <ManualEntryForm companyId={membership.companyId} employees={employees} />
        </div>
      </div>

      {staleEntries.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800">{t.adminTimeEntries.staleClockIns}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {t.adminTimeEntries.staleDesc(
                staleEntries.map((e) => e.user.name ?? e.user.email).join(", "),
                staleEntries.length === 1
              )}
            </p>
          </div>
        </div>
      )}

      {activeEntries.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">{t.adminTimeEntries.currentlyWorking}</p>
          <div className="flex flex-wrap gap-2">
            {activeEntries.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                {e.user.name ?? e.user.email} · {t.common.since} {e.clockIn.toLocaleTimeString(t.dateLocale, { hour: "2-digit", minute: "2-digit" })}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        {entries.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">{t.common.noTimeEntries}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.employee}</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.date}</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.clockIn}</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.clockOut}</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.hours}</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.status}</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.actions}</th>
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
                      {e.clockIn.toLocaleDateString(t.dateLocale)}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{fmt(e.clockIn, t.dateLocale)}</td>
                    <td className="px-4 py-3">{e.clockOut ? fmt(e.clockOut, t.dateLocale) : <span className="text-green-600">{t.common.active}</span>}</td>
                    <td className="px-4 py-3 text-stone-700">{hours}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} t={t} />
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

function fmt(d: Date, dateLocale: string) {
  return d.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status, t }: { status: string; t: Translations }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-green-50 text-green-700",
    REJECTED: "bg-red-50 text-red-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {t.common.statusLabel(status)}
    </span>
  );
}
