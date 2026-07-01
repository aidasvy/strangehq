import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { DEFAULT_PAYROLL_CONFIG, calculateHourBreakdown, calculatePayroll } from "@/lib/payroll";

function csv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await params;
  const url = new URL(req.url);

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership || (membership.role !== "ADMIN" && membership.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = membership.companyId;

  if (type === "employees") {
    const members = await db.companyMember.findMany({
      where: { companyId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    const rows = [
      ["Name", "Email", "Role", "Position", "Gross hourly rate (€)", "Joined"],
      ...members.map((m) => [
        m.user.name ?? "",
        m.user.email ?? "",
        m.role,
        m.position ?? "",
        m.hourlyRate?.toString() ?? "",
        m.createdAt.toLocaleDateString("lt-LT"),
      ]),
    ];
    return new Response(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="employees.csv"',
      },
    });
  }

  if (type === "time-entries") {
    if (membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const clockInFilter: { gte?: Date; lte?: Date } = {};
    if (from) clockInFilter.gte = new Date(from);
    if (to) clockInFilter.lte = new Date(to + "T23:59:59");
    const where = { companyId, ...(Object.keys(clockInFilter).length > 0 ? { clockIn: clockInFilter } : {}) };

    const entries = await db.timeEntry.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { clockIn: "desc" },
    });
    const rows = [
      ["Employee", "Email", "Date", "Clock in", "Clock out", "Hours", "Status", "Notes"],
      ...entries.map((e) => {
        const hours = e.clockOut
          ? ((e.clockOut.getTime() - e.clockIn.getTime()) / 3600000).toFixed(2)
          : "";
        return [
          e.user.name ?? "",
          e.user.email ?? "",
          e.clockIn.toLocaleDateString("lt-LT"),
          e.clockIn.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }),
          e.clockOut ? e.clockOut.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }) : "",
          hours,
          e.status,
          e.notes ?? "",
        ];
      }),
    ];
    return new Response(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="time-entries.csv"',
      },
    });
  }

  if (type === "payroll" && membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (type === "payroll") {
    const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(url.searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const [members, dbConfig, entries] = await Promise.all([
      db.companyMember.findMany({
        where: { companyId },
        include: { user: { select: { name: true, email: true } } },
      }),
      db.payrollConfig.findUnique({ where: { companyId } }),
      db.timeEntry.findMany({
        where: { companyId, status: "APPROVED", clockIn: { gte: monthStart, lte: monthEnd }, clockOut: { not: null } },
      }),
    ]);

    const config = dbConfig
      ? {
          ...DEFAULT_PAYROLL_CONFIG,
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

    const entriesByUser: Record<string, Array<{ clockIn: Date; clockOut: Date }>> = {};
    entries.forEach((e) => {
      if (!e.clockOut) return;
      if (!entriesByUser[e.userId]) entriesByUser[e.userId] = [];
      entriesByUser[e.userId].push({ clockIn: e.clockIn, clockOut: e.clockOut });
    });

    const rows = [
      ["Employee", "Email", "Total hours", "Night hours", "Sunday hours", "Holiday hours", "Gross (€)", "Sodra employee (€)", "NPD (€)", "Taxable (€)", "GPM (€)", "Net (€)", "Employer cost (€)"],
      ...members.map((m) => {
        const rate = m.hourlyRate ? Number(m.hourlyRate) : 0;
        const memberEntries = entriesByUser[m.userId] ?? [];
        const totalHours = memberEntries.reduce(
          (s, e) => s + (e.clockOut.getTime() - e.clockIn.getTime()) / 3600000, 0
        );

        if (rate === 0 || totalHours === 0) {
          return [m.user.name ?? "", m.user.email ?? "", totalHours.toFixed(2), "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00"];
        }

        const bd = calculateHourBreakdown(memberEntries, rate, config);
        const p = calculatePayroll(bd.effectiveGross, config);

        return [
          m.user.name ?? "",
          m.user.email ?? "",
          totalHours.toFixed(2),
          bd.nightHours.toFixed(2),
          bd.sundayHours.toFixed(2),
          bd.holidayHours.toFixed(2),
          bd.effectiveGross.toFixed(2),
          p.sodraEmployee.toFixed(2),
          p.npd.toFixed(2),
          p.taxableIncome.toFixed(2),
          p.gpm.toFixed(2),
          p.netMonthly.toFixed(2),
          p.totalEmployerCost.toFixed(2),
        ];
      }),
    ];
    return new Response(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-${year}-${String(month).padStart(2, "0")}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
}
