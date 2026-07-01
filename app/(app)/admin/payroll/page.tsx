import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { DEFAULT_PAYROLL_CONFIG, calculateHourBreakdown } from "@/lib/payroll";
import Link from "next/link";
import { PayrollCalculator } from "./payroll-calculator";
import { PayrollSummary } from "./payroll-summary";
import { cookies } from "next/headers";
import { getTranslations } from "@/lib/i18n/translations";

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

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

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
        nightPremium: Number(dbConfig.nightPremium),
        sundayPremium: Number(dbConfig.sundayPremium),
        holidayPremium: Number(dbConfig.holidayPremium),
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
    const entries = approvedEntries
      .filter((e) => e.userId === m.userId && e.clockOut !== null)
      .map((e) => ({ clockIn: e.clockIn, clockOut: e.clockOut! }));

    const totalHours = entries.reduce(
      (sum, e) => sum + (e.clockOut.getTime() - e.clockIn.getTime()) / 3600000,
      0
    );

    const hourlyRate = m.hourlyRate ? Number(m.hourlyRate) : null;
    const breakdown =
      hourlyRate !== null && entries.length > 0
        ? calculateHourBreakdown(entries, hourlyRate, config)
        : null;

    return {
      memberId: m.id,
      name: m.user.name ?? m.user.email,
      hourlyRate,
      totalHours,
      entryCount: entries.length,
      breakdown,
    };
  });

  const monthLabel = new Date(year, month - 1).toLocaleDateString(t.dateLocale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-6 space-y-8">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backOverview}</Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{t.adminPayroll.title}</h1>
          <p className="text-sm text-stone-500">{t.adminPayroll.subtitle}</p>
        </div>
        <a
          href={`/api/admin/export/payroll?year=${year}&month=${month}`}
          download
          className="shrink-0 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 shadow-sm transition-colors"
        >
          {t.common.exportCsv}
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
        <h2 className="text-lg font-semibold text-stone-900 mb-4">{t.adminPayroll.manualCalc}</h2>
        <PayrollCalculator config={config} employees={employeeOptions} />
      </div>
    </div>
  );
}
