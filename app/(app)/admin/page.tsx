import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "@/lib/i18n/translations";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
    include: { company: true },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

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
    { label: t.adminOverview.pendingApprovals, value: pendingEntries, href: "/admin/time-entries", urgent: pendingEntries > 0 },
    { label: t.adminOverview.holidayRequests, value: pendingHolidays, href: "/admin/holidays", urgent: pendingHolidays > 0 },
    { label: t.adminOverview.teamMembers, value: employeeCount, href: "/admin/employees", urgent: false },
    { label: t.adminOverview.locations, value: locationCount, href: "/admin/locations", urgent: false },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{membership.company.name}</h1>
        <p className="text-sm text-stone-500">{t.adminOverview.subtitle}</p>
      </div>

      {/* Live staff status */}
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-stone-700">{t.adminOverview.whoWorking}</p>
          <Link href="/admin/time-entries" className="text-xs text-stone-400 hover:text-stone-600">
            {t.adminOverview.viewAll}
          </Link>
        </div>
        {activeEntries.length === 0 ? (
          <p className="text-sm text-stone-400">{t.adminOverview.nobodyClocked}</p>
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
                  {stale && <span className="text-amber-500">{t.adminOverview.mayForgot}</span>}
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
        <QuickAction href="/admin/schedule" title={t.adminOverview.scheduleBuilder} desc={t.adminOverview.scheduleDesc} />
        <QuickAction href="/admin/payroll" title={t.adminOverview.payroll} desc={t.adminOverview.payrollDesc} />
        <QuickAction href="/admin/time-entries" title={t.adminOverview.approveEntries} desc={t.adminOverview.approveEntriesDesc} />
        <QuickAction href="/admin/holidays" title={t.adminOverview.holidayRequests} desc={t.adminOverview.holidayRequestsDesc} />
        <QuickAction href="/admin/locations" title={t.adminOverview.locationsStaffing} desc={t.adminOverview.locationsDesc} />
        <QuickAction href="/admin/swap-requests" title="Shift swaps" desc="Review and approve shift swap requests" />
        <QuickAction href="/admin/settings" title={t.adminOverview.settingsInvite} desc={t.adminOverview.settingsDesc} />
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
