import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { HolidayRequestForm } from "./holiday-request-form";
import { CancelRequestButton } from "./cancel-request-button";
import { computeLeaveBalance } from "@/lib/leave";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations, type Translations } from "@/lib/i18n/translations";

export default async function HolidaysPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  if (!membership.employmentStartDate) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
        <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backHome}</Link>
        <h1 className="text-2xl font-bold text-stone-900">{t.timeOff.title}</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center space-y-2">
          <p className="text-sm font-medium text-amber-800">{t.timeOff.notSetup}</p>
          <p className="text-xs text-amber-600">{t.timeOff.notSetupDesc}</p>
        </div>
      </div>
    );
  }

  const year = new Date().getFullYear();

  const allRequests = await db.holidayRequest.findMany({
    where: { userId: session.user.id, companyId: membership.companyId },
    orderBy: { createdAt: "desc" },
  });

  const approved = allRequests
    .filter((r) => r.status === "APPROVED")
    .map((r) => ({ startDate: r.startDate, endDate: r.endDate, type: r.type }));
  const pending = allRequests
    .filter((r) => r.status === "PENDING")
    .map((r) => ({ startDate: r.startDate, endDate: r.endDate, type: r.type }));

  const balance = computeLeaveBalance(
    membership.annualLeaveDays,
    membership.employmentStartDate,
    approved,
    pending,
    year,
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backHome}</Link>
      <h1 className="text-2xl font-bold text-stone-900">{t.timeOff.title}</h1>

      {/* Balance banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.timeOff.entitlement, value: balance.entitlement, unit: "days", color: "text-stone-700" },
          { label: t.timeOff.carriedOver(balance.carryoverDays), value: balance.carryoverDays, unit: "days", color: balance.carryoverDays > 0 ? "text-blue-700" : "text-stone-400" },
          { label: t.timeOff.used, value: balance.usedDays, unit: "days", color: "text-stone-700" },
          { label: t.timeOff.remaining, value: balance.remainingDays, unit: "days", color: balance.remainingDays <= 3 ? "text-red-600" : "text-green-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-stone-200 bg-white shadow-sm p-3 text-center">
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {balance.pendingDays > 0 && (
        <p className="text-xs text-amber-600">{t.timeOff.pendingNote(balance.pendingDays)}</p>
      )}

      <HolidayRequestForm companyId={membership.companyId} balance={balance} />

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-sm text-stone-900">{t.timeOff.yourRequests}</h2>
        </div>
        {allRequests.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">{t.timeOff.noRequests}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {allRequests.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-800">
                      {new Date(r.startDate).toLocaleDateString(t.dateLocale)}
                      {r.startDate.toISOString().slice(0, 10) !== r.endDate.toISOString().slice(0, 10) && (
                        <> — {new Date(r.endDate).toLocaleDateString(t.dateLocale)}</>
                      )}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.type === "PAID" ? "bg-stone-100 text-stone-600" : "bg-orange-50 text-orange-700"
                    }`}>
                      {r.type === "PAID" ? t.timeOff.paid : t.timeOff.unpaid}
                    </span>
                  </div>
                  {r.reason && <p className="text-xs text-stone-400 mt-0.5">{r.reason}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.status === "PENDING" && <CancelRequestButton requestId={r.id} />}
                  <StatusBadge status={r.status} t={t} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: Translations }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-green-50 text-green-700",
    REJECTED: "bg-red-50 text-red-600",
  };
  return (
    <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {t.common.statusLabel(status)}
    </span>
  );
}
