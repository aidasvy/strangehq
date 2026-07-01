import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { hourlyRate, position, role, annualLeaveDays, employmentStartDate } = await req.json();

  const target = await db.companyMember.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: target.companyId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (hourlyRate !== undefined && hourlyRate !== null) {
    if (typeof hourlyRate !== "number" || !Number.isFinite(hourlyRate) || hourlyRate < 0) {
      return NextResponse.json({ error: "Hourly rate must be a non-negative number" }, { status: 400 });
    }
  }

  // Prevent removing the last active admin via role change
  if (role !== undefined && target.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await db.companyMember.count({
      where: { companyId: target.companyId, role: "ADMIN", isActive: true },
    });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Cannot demote the last admin — promote someone else first" }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (hourlyRate !== undefined) updates.hourlyRate = hourlyRate;
  if (position !== undefined) updates.position = position;
  if (role !== undefined && ["EMPLOYEE", "MANAGER", "ADMIN"].includes(role)) updates.role = role;
  if (annualLeaveDays !== undefined && Number.isInteger(annualLeaveDays) && annualLeaveDays >= 0) updates.annualLeaveDays = annualLeaveDays;
  if (employmentStartDate !== undefined) {
    updates.employmentStartDate = employmentStartDate ? new Date(employmentStartDate) : null;
  }

  const updated = await db.companyMember.update({ where: { id }, data: updates });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const target = await db.companyMember.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: target.companyId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (target.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  if (target.role === "ADMIN") {
    const adminCount = await db.companyMember.count({
      where: { companyId: target.companyId, role: "ADMIN", isActive: true },
    });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Cannot remove the last admin — promote someone else first" }, { status: 400 });
    }
  }

  await db.companyMember.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
