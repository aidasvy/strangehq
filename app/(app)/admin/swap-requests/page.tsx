import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SwapActions } from "./swap-actions";

function fmtShift(date: Date, startTime: string, endTime: string, location: string) {
  const day = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${startTime}–${endTime} @ ${location}`;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING_TARGET: "bg-amber-50 text-amber-700 border-amber-200",
    PENDING_ADMIN: "bg-blue-50 text-blue-700 border-blue-200",
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    REJECTED: "bg-stone-100 text-stone-500 border-stone-200",
  };
  const labels: Record<string, string> = {
    PENDING_TARGET: "Awaiting colleague",
    PENDING_ADMIN: "Needs approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[status] ?? "bg-stone-100 text-stone-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default async function SwapRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership || (membership.role !== "ADMIN" && membership.role !== "MANAGER")) {
    redirect("/dashboard");
  }

  const swaps = await db.shiftSwapRequest.findMany({
    where: { companyId: membership.companyId },
    include: {
      requester: { select: { name: true } },
      targetUser: { select: { name: true } },
      requesterShift: { include: { schedule: { select: { location: { select: { name: true } } } } } },
      targetShift: { include: { schedule: { select: { location: { select: { name: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const pending = swaps.filter((s) => s.status === "PENDING_ADMIN");
  const others = swaps.filter((s) => s.status !== "PENDING_ADMIN");

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Overview</Link>
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Shift swaps</h1>
        <p className="text-sm text-stone-500 mt-0.5">Review and approve swap requests between employees.</p>
      </div>

      {swaps.length === 0 && (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-8 text-center text-sm text-stone-400">
          No swap requests yet.
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Needs your approval</h2>
          {pending.map((sw) => (
            <div key={sw.id} className="rounded-lg border border-stone-200 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {sw.requester.name} ↔ {sw.targetUser.name}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Requested {sw.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                {statusBadge(sw.status)}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md bg-stone-50 p-3">
                  <p className="text-stone-400 mb-1">{sw.requester.name} takes</p>
                  <p className="font-medium text-stone-800">{fmtShift(sw.targetShift.date, sw.targetShift.startTime, sw.targetShift.endTime, sw.targetShift.schedule.location.name)}</p>
                </div>
                <div className="rounded-md bg-stone-50 p-3">
                  <p className="text-stone-400 mb-1">{sw.targetUser.name} takes</p>
                  <p className="font-medium text-stone-800">{fmtShift(sw.requesterShift.date, sw.requesterShift.startTime, sw.requesterShift.endTime, sw.requesterShift.schedule.location.name)}</p>
                </div>
              </div>
              <SwapActions swapId={sw.id} />
            </div>
          ))}
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">History</h2>
          <div className="rounded-lg border border-stone-200 bg-white shadow-sm divide-y divide-stone-100">
            {others.map((sw) => (
              <div key={sw.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    {sw.requester.name} ↔ {sw.targetUser.name}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {fmtShift(sw.requesterShift.date, sw.requesterShift.startTime, sw.requesterShift.endTime, sw.requesterShift.schedule.location.name)} →{" "}
                    {fmtShift(sw.targetShift.date, sw.targetShift.startTime, sw.targetShift.endTime, sw.targetShift.schedule.location.name)}
                  </p>
                </div>
                {statusBadge(sw.status)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
