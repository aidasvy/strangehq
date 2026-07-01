import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { HolidayApproveButtons } from "./holiday-approve-buttons";
import { computeLeaveBalance } from "@/lib/leave";
import { countWorkingDays } from "@/lib/leave";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations, type Translations } from "@/lib/i18n/translations";

export default async function AdminHolidaysPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  const year = new Date().getFullYear();

  const [requests, members] = await Promise.all([
    db.holidayRequest.findMany({
      where: { companyId: membership.companyId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    db.companyMember.findMany({
      where: { companyId: membership.companyId },
      select: { userId: true, annualLeaveDays: true, employmentStartDate: true, user: { select: { name: true, email: true } } },
    }),
  ]);

  const balanceByUser: Record<string, ReturnType<typeof computeLeaveBalance>> = {};
  members.forEach((m) => {
    const memberRequests = requests.filter((r) => r.userId === m.userId);
    const approved = memberRequests
      .filter((r) => r.status === "APPROVED")
      .map((r) => ({ startDate: r.startDate, endDate: r.endDate, type: r.type }));
    const pending = memberRequests
      .filter((r) => r.status === "PENDING")
      .map((r) => ({ startDate: r.startDate, endDate: r.endDate, type: r.type }));
    balanceByUser[m.userId] = computeLeaveBalance(m.annualLeaveDays, m.employmentStartDate, approved, pending, year);
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const rest = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backOverview}</Link>
      <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-black">{t.adminHolidays.title}</h1>

      {/* Leave balance summary per employee */}
      <div>
        <h2 className="text-sm font-semibold text-stone-700 mb-2">{t.adminHolidays.leaveBalances} — {year}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const b = balanceByUser[m.userId];
            return (
              <div key={m.userId} className="rounded-lg border border-stone-200 bg-white shadow-sm px-4 py-3">
                <p className="text-sm font-medium text-stone-800">{m.user.name ?? m.user.email}</p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-stone-500">{t.adminHolidays.entitlement} <strong className="text-stone-800">{b.entitlement}d</strong></span>
                  <span className="text-stone-500">{t.adminHolidays.used} <strong className="text-stone-800">{b.usedDays}d</strong></span>
                  <span className={b.remainingDays <= 2 ? "text-red-600 font-semibold" : "text-green-700"}>
                    {t.adminHolidays.left} <strong>{b.remainingDays}d</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-700 mb-2">{t.adminHolidays.pendingApproval}</h2>
          <RequestTable requests={pending} balanceByUser={balanceByUser} showActions t={t} />
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-700 mb-2">{t.adminHolidays.history}</h2>
          <RequestTable requests={rest} balanceByUser={balanceByUser} showActions={false} t={t} />
        </div>
      )}

      {requests.length === 0 && (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-8 text-center text-sm text-stone-400">
          {t.adminHolidays.noRequests}
        </div>
      )}
    </div>
  );
}

function RequestTable({
  requests,
  balanceByUser,
  showActions,
  t,
}: {
  requests: Array<{
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    reason: string | null;
    type: string;
    status: string;
    user: { name: string | null; email: string };
  }>;
  balanceByUser: Record<string, { remainingDays: number; entitlement: number; usedDays: number }>;
  showActions: boolean;
  t: Translations;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Mobile card view */}
      <div className="sm:hidden divide-y divide-stone-100">
        {requests.map((r) => {
          const days = countWorkingDays(r.startDate, r.endDate);
          const b = balanceByUser[r.userId];
          return (
            <div key={r.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-stone-900 text-sm">{r.user.name ?? "—"}</p>
                  <p className="text-xs text-stone-400">{r.user.email}</p>
                </div>
                <StatusBadge status={r.status} t={t} />
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-stone-600">
                <span>{new Date(r.startDate).toLocaleDateString(t.dateLocale)} — {new Date(r.endDate).toLocaleDateString(t.dateLocale)}</span>
                <span className="text-stone-400">·</span>
                <span>{t.common.workingDays(days)}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                  r.type === "PAID" ? "bg-stone-100 text-stone-600" : "bg-orange-50 text-orange-700"
                }`}>{r.type === "PAID" ? t.common.paid : t.common.unpaid}</span>
              </div>
              {r.type === "PAID" && b && (
                <p className="text-xs text-stone-400">{t.adminHolidays.used} {b.usedDays}d / {b.entitlement}d {t.adminHolidays.entitlement.replace(":", "")}</p>
              )}
              {r.reason && <p className="text-xs text-stone-400 italic">{r.reason}</p>}
              {showActions && r.status === "PENDING" && <HolidayApproveButtons requestId={r.id} />}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <table className="hidden sm:table w-full text-sm">
        <thead className="bg-stone-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.employee}</th>
            <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.dates}</th>
            <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.days}</th>
            <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.type}</th>
            <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.balance}</th>
            <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.reason}</th>
            <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.status}</th>
            {showActions && <th className="px-4 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {requests.map((r) => {
            const days = countWorkingDays(r.startDate, r.endDate);
            const b = balanceByUser[r.userId];
            return (
              <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-stone-900">{r.user.name ?? "—"}</p>
                  <p className="text-xs text-stone-400">{r.user.email}</p>
                </td>
                <td className="px-4 py-3 text-stone-700 whitespace-nowrap">
                  {new Date(r.startDate).toLocaleDateString(t.dateLocale)}
                  {r.startDate.toISOString().slice(0, 10) !== r.endDate.toISOString().slice(0, 10) && (
                    <> — {new Date(r.endDate).toLocaleDateString(t.dateLocale)}</>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-600 tabular-nums">{days}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.type === "PAID" ? "bg-stone-100 text-stone-600" : "bg-orange-50 text-orange-700"
                  }`}>
                    {r.type === "PAID" ? t.common.paid : t.common.unpaid}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-stone-400 tabular-nums">
                  {r.type === "PAID" && b ? `${b.usedDays}/${b.entitlement}d` : "—"}
                </td>
                <td className="px-4 py-3 text-stone-500">{r.reason ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} t={t} /></td>
                {showActions && (
                  <td className="px-4 py-3">
                    {r.status === "PENDING" && <HolidayApproveButtons requestId={r.id} />}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
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
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {t.common.statusLabel(status)}
    </span>
  );
}
