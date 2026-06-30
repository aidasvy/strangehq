import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { DEFAULT_PAYROLL_CONFIG } from "@/lib/payroll";
import { PayrollCalculator } from "./payroll-calculator";
import { PayrollSummary } from "./payroll-summary";

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
    include: { company: { include: { payrollConfig: true } } },
  });
  if (!membership) redirect("/onboarding");
  if (membership.role !== "ADMIN") redirect("/admin");

  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()));
  const month = parseInt(sp.month ?? String(now.getMonth() + 1));
  const { start, end } = getMonthRange(year, month);

  const dbConfig = membership.company.payrollConfig;
  const config = dbConfig
    ? {
        gpmRate: Number(dbConfig.gpmRate),
        gpmHighRate: Number(dbConfig.gpmHighRate),
        gpmAnnualThreshold: Number(dbConfig.gpmAnnualThreshold),
        sodraEmployee: Number(dbConfig.sodraEmployee),
        sodraEmployer: Number(dbConfig.sodraEmployer),
        npdBase: Number(dbConfig.npdBase),
        npdCoefficient: Number(dbConfig.npdCoefficient),
        minimumWage: Number(dbConfig.minimumWage),
      }
    : DEFAULT_PAYROLL_CONFIG;

  const members = await db.companyMember.findMany({
    where: { companyId: membership.companyId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const approvedEntries = await db.timeEntry.findMany({
    where: {
      companyId: membership.companyId,
      status: "APPROVED",
      clockIn: { gte: start },
      clockOut: { lte: end, not: null },
    },
  });

  const employeeOptions = members.map((m) => ({
    id: m.id,
    name: m.user.name ?? m.user.email,
    hourlyRate: m.hourlyRate ? Number(m.hourlyRate) : null,
  }));

  const summaryData = members.map((m) => {
    const entries = approvedEntries.filter((e) => e.userId === m.userId);
    const totalHours = entries.reduce((sum, e) => {
      if (!e.clockOut) return sum;
      return sum + (e.clockOut.getTime() - e.clockIn.getTime()) / 3600000;
    }, 0);
    return {
      memberId: m.id,
      name: m.user.name ?? m.user.email,
      hourlyRate: m.hourlyRate ? Number(m.hourlyRate) : null,
      totalHours,
      entryCount: entries.length,
    };
  });

  const monthLabel = new Date(year, month - 1).toLocaleDateString("lt-LT", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Payroll</h1>
          <p className="text-sm text-stone-500">Lithuanian GPM, Sodra, and NPD applied automatically</p>
        </div>
        <a
          href={`/api/admin/export/payroll?year=${year}&month=${month}`}
          download
          className="shrink-0 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 shadow-sm transition-colors"
        >
          Export CSV
        </a>
      </div>

      <PayrollSummary
        summaryData={summaryData}
        config={config}
        year={year}
        month={month}
        monthLabel={monthLabel}
      />

      <div>
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Manual calculator</h2>
        <PayrollCalculator config={config} employees={employeeOptions} />
      </div>
    </div>
  );
}
