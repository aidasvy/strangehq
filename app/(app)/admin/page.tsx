import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
    include: { company: true },
  });
  if (!membership) redirect("/onboarding");

  const companyId = membership.companyId;

  const [pendingEntries, pendingHolidays, employeeCount, locationCount, activeEntries] = await Promise.all([
    db.timeEntry.count({ where: { companyId, status: "PENDING", clockOut: { not: null } } }),
    db.holidayRequest.count({ where: { companyId, status: "PENDING" } }),
    db.companyMember.count({ where: { companyId } }),
    db.location.count({ where: { companyId } }),
    db.timeEntry.findMany({
      where: { companyId, clockOut: null },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { clockIn: "asc" },
    }),
  ]);

  const stats = [
    { label: "Pending approvals", value: pendingEntries, href: "/admin/time-entries", urgent: pendingEntries > 0 },
    { label: "Holiday requests", value: pendingHolidays, href: "/admin/holidays", urgent: pendingHolidays > 0 },
    { label: "Team members", value: employeeCount, href: "/admin/employees", urgent: false },
    { label: "Locations", value: locationCount, href: "/admin/locations", urgent: false },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{membership.company.name}</h1>
        <p className="text-sm text-stone-500">Admin overview</p>
      </div>

      {/* Live staff status */}
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-stone-700">Who&apos;s working now</p>
          <Link href="/admin/time-entries" className="text-xs text-stone-400 hover:text-stone-600">
            View all →
          </Link>
        </div>
        {activeEntries.length === 0 ? (
          <p className="text-sm text-stone-400">Nobody is clocked in right now</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeEntries.map((e) => {
              const ms = Date.now() - e.clockIn.getTime();
              const h = Math.floor(ms / 3600000);
              const m = Math.floor((ms % 3600000) / 60000);
              const stale = ms > 12 * 3600000;
              return (
                <span key={e.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${stale ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-green-50 border-green-200 text-green-800"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${stale ? "bg-amber-400 animate-pulse" : "bg-green-500 animate-pulse"}`} />
                  {e.user.name ?? e.user.email}
                  <span className={`font-normal ml-0.5 ${stale ? "text-amber-600" : "text-green-600"}`}>{h}h {String(m).padStart(2, "0")}m</span>
                  {stale && <span className="text-amber-500">· may have forgotten to clock out</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-lg border p-4 hover:shadow-md transition-shadow bg-white shadow-sm ${
              s.urgent && s.value > 0 ? "border-amber-300" : "border-stone-200"
            }`}
          >
            <p className={`text-3xl font-bold ${s.urgent && s.value > 0 ? "text-amber-600" : "text-stone-900"}`}>
              {s.value}
            </p>
            <p className="text-sm text-stone-500 mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickAction href="/admin/schedule" title="Schedule builder" desc="Create and publish the weekly rota" />
        <QuickAction href="/admin/payroll" title="Payroll" desc="Monthly salary summary with tax breakdown" />
        <QuickAction href="/admin/time-entries" title="Approve time entries" desc="Review and approve submitted hours" />
        <QuickAction href="/admin/holidays" title="Holiday requests" desc="Approve or reject time-off requests" />
        <QuickAction href="/admin/locations" title="Locations & staffing" desc="Manage venues and minimum staff requirements" />
        <QuickAction href="/admin/settings" title="Settings & invite codes" desc="Generate codes to onboard new employees" />
      </div>
    </div>
  );
}

function QuickAction({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="rounded-lg border border-stone-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow">
      <p className="font-semibold text-sm text-stone-900">{title}</p>
      <p className="text-xs text-stone-500 mt-1">{desc}</p>
    </Link>
  );
}
