import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ClockControls } from "./clock-controls";
import { RejectedEntryEditor } from "./rejected-entry-editor";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations, type Translations } from "@/lib/i18n/translations";

export default async function HoursPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const userId = session.user.id;

  const membership = await db.companyMember.findFirst({ where: { userId } });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

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
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backHome}</Link>
      <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-black">{t.hours.title}</h1>

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
          <h2 className="font-semibold text-sm text-stone-900">{t.hours.recentEntries}</h2>
        </div>
        {recentEntries.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">{t.common.noTimeEntries}</p>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden divide-y divide-stone-100">
              {recentEntries.map((entry) => {
                const hours = entry.clockOut
                  ? ((entry.clockOut.getTime() - entry.clockIn.getTime()) / 3600000).toFixed(2)
                  : "—";
                return (
                  <div key={entry.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm text-stone-700">
                        {entry.clockIn.toLocaleDateString(t.dateLocale, { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      <StatusBadge status={entry.status} t={t} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-stone-400">{t.common.clockIn}</p>
                        <p className="font-mono text-stone-700">{fmt(entry.clockIn, t.dateLocale)}</p>
                      </div>
                      <div>
                        <p className="text-stone-400">{t.common.clockOut}</p>
                        <p className="font-mono">{entry.clockOut ? fmt(entry.clockOut, t.dateLocale) : <span className="text-green-600 font-medium">{t.common.active}</span>}</p>
                      </div>
                      <div>
                        <p className="text-stone-400">{t.common.hours}</p>
                        <p className="font-mono text-stone-700">{hours}</p>
                      </div>
                    </div>
                    {entry.status === "REJECTED" && entry.clockOut && (
                      <RejectedEntryEditor
                        entryId={entry.id}
                        clockIn={entry.clockIn.toISOString()}
                        clockOut={entry.clockOut.toISOString()}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.date}</th>
                  <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.clockIn}</th>
                  <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.clockOut}</th>
                  <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.hours}</th>
                  <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentEntries.map((entry) => {
                  const hours = entry.clockOut
                    ? ((entry.clockOut.getTime() - entry.clockIn.getTime()) / 3600000).toFixed(2)
                    : "—";
                  return (
                    <tr key={entry.id} className="hover:bg-stone-50 transition-colors align-top">
                      <td className="px-4 py-3 font-mono text-stone-600">
                        {entry.clockIn.toLocaleDateString(t.dateLocale, { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-mono text-stone-700">{fmt(entry.clockIn, t.dateLocale)}</td>
                      <td className="px-4 py-3 font-mono">{entry.clockOut ? fmt(entry.clockOut, t.dateLocale) : <span className="text-green-600 font-medium">{t.common.active}</span>}</td>
                      <td className="px-4 py-3 font-mono text-stone-700">{hours}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} t={t} />
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
          </>
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
