import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { EmployeeRateEditor } from "./employee-rate-editor";
import { EmployeeRoleEditor } from "./employee-role-editor";
import { EmployeeLeaveDaysEditor } from "./employee-leave-days-editor";
import { RemoveMemberButton } from "./remove-member-button";
import Link from "next/link";

export default async function EmployeesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const members = await db.companyMember.findMany({
    where: { companyId: membership.companyId },
    include: { user: { select: { name: true, email: true, image: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Overview</Link>
      <h1 className="text-2xl font-bold text-stone-900">Employees</h1>

      <div className="flex justify-end">
        <a
          href="/api/admin/export/employees"
          download
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 shadow-sm transition-colors"
        >
          Export CSV
        </a>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Role</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Position</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Gross hourly rate (€)</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Annual leave</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Joined</th>
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
                <td className="px-4 py-3 text-stone-500">{m.position ?? "—"}</td>
                <td className="px-4 py-3">
                  <EmployeeRateEditor memberId={m.id} currentRate={m.hourlyRate?.toString() ?? ""} />
                </td>
                <td className="px-4 py-3">
                  <EmployeeLeaveDaysEditor memberId={m.id} currentDays={m.annualLeaveDays} />
                </td>
                <td className="px-4 py-3 text-stone-400 text-xs">
                  {m.createdAt.toLocaleDateString("lt-LT")}
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
