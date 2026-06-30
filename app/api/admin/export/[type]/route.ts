import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

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

    const members = await db.companyMember.findMany({
      where: { companyId },
      include: { user: { select: { name: true, email: true } } },
    });
    const entries = await db.timeEntry.findMany({
      where: { companyId, status: "APPROVED", clockIn: { gte: monthStart, lte: monthEnd }, clockOut: { not: null } },
    });

    const hoursByUser: Record<string, number> = {};
    entries.forEach((e) => {
      if (!e.clockOut) return;
      hoursByUser[e.userId] = (hoursByUser[e.userId] ?? 0) + (e.clockOut.getTime() - e.clockIn.getTime()) / 3600000;
    });

    // Lithuanian payroll constants
    const GPM = 0.2;
    const SODRA_EMP = 0.1952;
    const SODRA_EMPLOYER = 0.0177;
    const NPD_BASE = 747;
    const NPD_COEFF = 0.49;
    const MMA = 1038;

    const rows = [
      ["Employee", "Email", "Hours", "Gross (€)", "Sodra employee (€)", "NPD (€)", "Taxable (€)", "GPM (€)", "Net (€)", "Employer cost (€)"],
      ...members.map((m) => {
        const hours = hoursByUser[m.userId] ?? 0;
        const rate = m.hourlyRate ? parseFloat(m.hourlyRate.toString()) : 0;
        const gross = parseFloat((hours * rate).toFixed(2));
        if (gross === 0) {
          return [m.user.name ?? "", m.user.email ?? "", hours.toFixed(2), "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00"];
        }
        const sodraEmp = parseFloat((gross * SODRA_EMP).toFixed(2));
        const sodraEmployer = parseFloat((gross * SODRA_EMPLOYER).toFixed(2));
        const npd = gross <= MMA ? NPD_BASE : Math.max(0, NPD_BASE - NPD_COEFF * (gross - MMA));
        const taxable = Math.max(0, gross - sodraEmp - npd);
        const gpm = parseFloat((taxable * GPM).toFixed(2));
        const net = parseFloat((gross - sodraEmp - gpm).toFixed(2));
        const employerCost = parseFloat((gross + sodraEmployer).toFixed(2));
        return [
          m.user.name ?? "",
          m.user.email ?? "",
          hours.toFixed(2),
          gross.toFixed(2),
          sodraEmp.toFixed(2),
          npd.toFixed(2),
          taxable.toFixed(2),
          gpm.toFixed(2),
          net.toFixed(2),
          employerCost.toFixed(2),
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
