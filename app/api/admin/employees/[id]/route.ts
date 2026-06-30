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

  await db.companyMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
