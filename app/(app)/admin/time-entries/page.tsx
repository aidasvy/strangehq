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

export default async function TimeEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  const sp = await searchParams;
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const fromDate = sp.from ? new Date(sp.from) : defaultFrom;
  const toDate = sp.to ? new Date(sp.to + "T23:59:59") : new Date();

  const [entries, members] = await Promise.all([
    db.timeEntry.findMany({
      where: { companyId: membership.companyId, clockIn: { gte: fromDate, lte: toDate } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { clockIn: "desc" },
      take: 200,
    }),
    db.companyMember.findMany({
      where: { companyId: membership.companyId, isActive: true },
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
          <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-black">{t.adminTimeEntries.title}</h1>
          {activeEntries.length > 0 && (
            <p className="text-sm text-green-700 mt-0.5">
              {t.adminTimeEntries.currentlyClocked(activeEntries.length)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BulkApproveButton pendingIds={pendingIds} />
          <a
            href={`/api/admin/export/time-entries?from=${fromDate.toISOString().slice(0, 10)}&to=${toDate.toISOString().slice(0, 10)}`}
            download
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 shadow-sm transition-colors"
          >
            {t.common.exportCsv}
          </a>
          <ManualEntryForm companyId={membership.companyId} employees={employees} />
        </div>
      </div>

      {/* Date range filter */}
      <form method="GET" className="flex items-center gap-2 flex-wrap text-sm">
        <label className="text-stone-500">{t.common.date}:</label>
        <input
          type="date"
          name="from"
          defaultValue={fromDate.toISOString().slice(0, 10)}
          className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <span className="text-stone-400">–</span>
        <input
          type="date"
          name="to"
          defaultValue={toDate.toISOString().slice(0, 10)}
          className="rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <button type="submit" className="rounded bg-stone-800 px-3 py-1 text-white text-sm hover:bg-stone-700 transition-colors">
          {t.common.filter ?? "Filter"}
        </button>
      </form>

      {staleEntries.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <svg className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
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
                    <td className="px-4 py-3 font-mono text-stone-600">
                      {e.clockIn.toLocaleDateString(t.dateLocale)}
                    </td>
                    <td className="px-4 py-3 font-mono text-stone-700">{fmt(e.clockIn, t.dateLocale)}</td>
                    <td className="px-4 py-3 font-mono">{e.clockOut ? fmt(e.clockOut, t.dateLocale) : <span className="text-green-600">{t.common.active}</span>}</td>
                    <td className="px-4 py-3 font-mono text-stone-700">{hours}</td>
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
