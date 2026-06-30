import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { HolidayRequestForm } from "./holiday-request-form";

export default async function HolidaysPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const requests = await db.holidayRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Holidays</h1>

      <HolidayRequestForm companyId={membership.companyId} />

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-sm text-stone-900">Your requests</h2>
        </div>
        {requests.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">No holiday requests yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-stone-500">From</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">To</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Reason</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 text-stone-700">{new Date(r.startDate).toLocaleDateString("lt-LT")}</td>
                  <td className="px-4 py-3 text-stone-700">{new Date(r.endDate).toLocaleDateString("lt-LT")}</td>
                  <td className="px-4 py-3 text-stone-500">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
