import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { HolidayRequestForm } from "./holiday-request-form";
import { computeLeaveBalance } from "@/lib/leave";
import Link from "next/link";

export default async function HolidaysPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const year = new Date().getFullYear();

  const [allRequests] = await Promise.all([
    db.holidayRequest.findMany({
      where: { userId: session.user.id, companyId: membership.companyId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const approved = allRequests
    .filter((r) => r.status === "APPROVED")
    .map((r) => ({ startDate: r.startDate, endDate: r.endDate, type: r.type }));
  const pending = allRequests
    .filter((r) => r.status === "PENDING")
    .map((r) => ({ startDate: r.startDate, endDate: r.endDate, type: r.type }));

  const balance = computeLeaveBalance(membership.annualLeaveDays, approved, pending, year);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Home</Link>
      <h1 className="text-2xl font-bold text-stone-900">Time Off</h1>

      {/* Balance banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Entitlement", value: balance.entitlement, unit: "days", color: "text-stone-700" },
          { label: "Used", value: balance.usedDays, unit: "days", color: "text-stone-700" },
          { label: "Pending", value: balance.pendingDays, unit: "days", color: "text-amber-600" },
          { label: "Remaining", value: balance.remainingDays, unit: "days", color: balance.remainingDays <= 3 ? "text-red-600" : "text-green-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-stone-200 bg-white shadow-sm p-3 text-center">
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <HolidayRequestForm companyId={membership.companyId} balance={balance} />

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-sm text-stone-900">Your requests</h2>
        </div>
        {allRequests.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">No time off requests yet</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {allRequests.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-800">
                      {new Date(r.startDate).toLocaleDateString("lt-LT")}
                      {r.startDate.toISOString().slice(0, 10) !== r.endDate.toISOString().slice(0, 10) && (
                        <> — {new Date(r.endDate).toLocaleDateString("lt-LT")}</>
                      )}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.type === "PAID" ? "bg-stone-100 text-stone-600" : "bg-orange-50 text-orange-700"
                    }`}>
                      {r.type === "PAID" ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                  {r.reason && <p className="text-xs text-stone-400 mt-0.5">{r.reason}</p>}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-green-50 text-green-700",
    REJECTED: "bg-red-50 text-red-600",
  };
  return (
    <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
