import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { EmployeeRateEditor } from "./employee-rate-editor";
import { EmployeeRoleEditor } from "./employee-role-editor";
import { EmployeeLeaveDaysEditor } from "./employee-leave-days-editor";
import { EmployeeStartDateEditor } from "./employee-start-date-editor";
import { EmployeePositionEditor } from "./employee-position-editor";
import { RemoveMemberButton } from "./remove-member-button";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "@/lib/i18n/translations";

export default async function EmployeesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  const members = await db.companyMember.findMany({
    where: { companyId: membership.companyId, isActive: true },
    include: { user: { select: { name: true, email: true, image: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backOverview}</Link>
      <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-black">{t.adminEmployees.title}</h1>

      <div className="flex justify-end">
        <a
          href="/api/admin/export/employees"
          download
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 shadow-sm transition-colors"
        >
          {t.common.exportCsv}
        </a>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.name}</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.role}</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">{t.common.position}</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">{t.adminEmployees.grossHourly}</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">{t.adminEmployees.annualLeave}</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">{t.adminEmployees.employmentStart}</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">{t.adminEmployees.joined}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-stone-900">{m.user.name ?? "—"}</p>
                  <p className="text-xs text-stone-400">{m.user.email}</p>
                  {m.user.phone && (
                    <p className="text-xs text-stone-400">{m.user.phone}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <EmployeeRoleEditor
                    memberId={m.id}
                    currentRole={m.role as "EMPLOYEE" | "MANAGER" | "ADMIN"}
                    isSelf={m.userId === membership.userId}
                  />
                </td>
                <td className="px-4 py-3">
                  <EmployeePositionEditor memberId={m.id} currentPosition={m.position ?? null} />
                </td>
                <td className="px-4 py-3">
                  <EmployeeRateEditor memberId={m.id} currentRate={m.hourlyRate?.toString() ?? ""} />
                </td>
                <td className="px-4 py-3">
                  <EmployeeLeaveDaysEditor memberId={m.id} currentDays={m.annualLeaveDays} />
                </td>
                <td className="px-4 py-3">
                  <EmployeeStartDateEditor
                    memberId={m.id}
                    currentDate={m.employmentStartDate ? m.employmentStartDate.toISOString().slice(0, 10) : null}
                  />
                </td>
                <td className="px-4 py-3 text-stone-400 text-xs">
                  {m.createdAt.toLocaleDateString(t.dateLocale)}
                </td>
                <td className="px-4 py-3">
                  <RemoveMemberButton memberId={m.id} name={m.user.name ?? m.user.email ?? "this person"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
